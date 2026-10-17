import json
from django.http import StreamingHttpResponse
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from apps.companies.serializers import StrictSerializer
from common.views import CompanyAPIView
from . import policy
from .assistant import make_context, conversations, create_conversation, conversation_payload, message_payload, chat
from .models import AIMessage
from .tools.registry import available_tools
from rest_framework.renderers import BaseRenderer


class EmptyInput(StrictSerializer):
    pass


class ChatInput(StrictSerializer):
    conversation_id = serializers.IntegerField(min_value=1)
    message = serializers.CharField(max_length=policy.MAX_MESSAGE, trim_whitespace=True)
    request_id = serializers.UUIDField(required=False)


class AssistantView(CompanyAPIView):
    required_permission = "ai.use"

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "private, no-store"
        return response

    def ctx(self):
        return make_context(self.request.company, self.request.membership)


class ConversationListView(AssistantView):
    def get(self, request):
        ctx = self.ctx()
        return Response(dict(conversations=[conversation_payload(ctx, c) for c in conversations(ctx)[:30]],
            **self.metadata(), availableTools=[dict(id=s.name, label=s.label) for s in available_tools(self.codes())],
            canChat=policy.enabled(), policyReason=None if policy.enabled() else "Le service IA local n'est pas configuré."))

    def post(self, request):
        self.validated(EmptyInput)
        ctx = self.ctx()
        return Response(conversation_payload(ctx, create_conversation(ctx)), status=201)


class ConversationDetailView(AssistantView):
    def get(self, request, conversation_id):
        ctx = self.ctx()
        obj = conversations(ctx).filter(pk=conversation_id).first()
        if obj is None:
            raise NotFound()
        return Response(conversation_payload(ctx, obj))

# update 10/15/2026
class EventStreamRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "event-stream"
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""

        if isinstance(data, bytes):
            return data

        if isinstance(data, str):
            return data.encode("utf-8")

        return (
            "data: "
            + json.dumps(data, ensure_ascii=False)
            + "\n\n"
        ).encode("utf-8")


class ChatView(AssistantView):
    streaming = False

    def get_renderers(self):
        if self.streaming:
            return [EventStreamRenderer()]
        return super().get_renderers()

    def post(self, request):
        data = self.validated(ChatInput)

        result = chat(
            self.ctx(),
            data["conversation_id"],
            data["message"],
            data.get("request_id"),
        )

        if not self.streaming:
            return Response(result)

        # Buffer until all citations and permissions pass.
        # Never stream unchecked model tokens.
        events = [
            dict(type="status", status="streaming"),
            *[
                dict(type="block", block=b)
                for b in result["blocks"]
            ],
            dict(type="done", message=result),
        ]

        response = StreamingHttpResponse(
            (
                "data: "
                + json.dumps(event, ensure_ascii=False)
                + "\n\n"
                for event in events
            ),
            content_type="text/event-stream",
        )

        response["Cache-Control"] = "no-store"
        response["X-Accel-Buffering"] = "no"

        return response


class MessageSourcesView(AssistantView):
    def get(self, request, message_id):
        ctx = self.ctx()
        obj = AIMessage.objects.select_related("conversation").filter(pk=message_id, conversation__in=conversations(ctx)).first()
        if obj is None:
            raise NotFound()
        return Response(message_payload(ctx, obj)["sources"])
