from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission
from .admin_selectors import (
    admin_metadata, company_memberships, company_roles, filter_memberships,
    membership_by_user, permission_catalog, role_by_id, role_payload, user_payload,
)
from .admin_serializers import AdminRoleInputSerializer, AdminUserInputSerializer
from .admin_services import save_company_user, save_custom_role


class AdminUsersView(APIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "users.manage"
    invite = False

    def get(self, request, user_id=None):
        meta = admin_metadata(company=request.company, membership=request.membership)
        if user_id is not None:
            return Response(user_payload(membership_by_user(company=request.company, user_id=user_id), actor=request.membership, permissions=meta["permissions"]))
        query = company_memberships(request.company)
        pager = CollectionPagination()
        rows = pager.paginate_queryset(filter_memberships(query, request.query_params), request)
        roles = list(company_roles(request.company))
        return Response(pager.envelope(key="users", rows=[user_payload(m, actor=request.membership, permissions=meta["permissions"]) for m in rows], **meta,
                                      roles=[dict(id=r.pk, name=r.name) for r in roles], departments=sorted(set(query.exclude(department="").values_list("department", flat=True))),
                                      currentUserId=request.user.pk, assignableRoleIds=[r.pk for r in roles if r.code != "owner"] if "roles.assign" in meta["permissions"] else [], canCreateDirectly=True))

    def write(self, request, user_id=None):
        serializer = AdminUserInputSerializer(data=request.data, partial=user_id is not None)
        serializer.is_valid(raise_exception=True)
        membership = save_company_user(company=request.company, actor=request.membership, data=serializer.validated_data, user_id=user_id, invite=self.invite)
        permissions = admin_metadata(company=request.company, membership=request.membership)["permissions"]
        return Response(user_payload(membership_by_user(company=request.company, user_id=membership.user_id), actor=request.membership, permissions=permissions), status=201 if user_id is None else 200)

    def post(self, request):
        return self.write(request)

    def patch(self, request, user_id):
        return self.write(request, user_id)


class AdminInvitationsView(AdminUsersView):
    http_method_names = ["post", "options"]
    invite = True


class AdminUserDetailView(AdminUsersView):
    http_method_names = ["get", "patch", "head", "options"]


class AdminRolesView(APIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "roles.manage"

    def get(self, request, role_id=None):
        meta = admin_metadata(company=request.company, membership=request.membership)
        if role_id is not None:
            return Response(role_payload(role_by_id(company=request.company, role_id=role_id), permissions=meta["permissions"]))
        query = company_roles(request.company)
        if request.query_params.get("search"):
            query = query.filter(name__icontains=request.query_params["search"][:150])
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        users = [user_payload(m, actor=request.membership, permissions=meta["permissions"]) for m in company_memberships(request.company)]
        return Response(pager.envelope(key="roles", rows=[role_payload(r, permissions=meta["permissions"]) for r in rows], **meta,
                                      users=[{k: u[k] for k in ("id", "name", "roleId")} for u in users]))

    def write(self, request, role_id=None):
        serializer = AdminRoleInputSerializer(data=request.data, partial=role_id is not None)
        serializer.is_valid(raise_exception=True)
        role = save_custom_role(company=request.company, actor=request.membership, data=serializer.validated_data, role_id=role_id)
        permissions = admin_metadata(company=request.company, membership=request.membership)["permissions"]
        return Response(role_payload(role_by_id(company=request.company, role_id=role.pk), permissions=permissions), status=201 if role_id is None else 200)

    def post(self, request):
        return self.write(request)

    def patch(self, request, role_id):
        return self.write(request, role_id)


class AdminPermissionsView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "roles.manage"

    def get(self, request):
        return Response(permission_catalog())


class AdminRoleDetailView(AdminRolesView):
    http_method_names = ["get", "patch", "head", "options"]
