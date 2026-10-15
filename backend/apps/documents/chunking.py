from langchain_text_splitters import RecursiveCharacterTextSplitter
from apps.intelligence import policy
from apps.intelligence.llm import AIError


def chunk_pages(pages):
    splitter = RecursiveCharacterTextSplitter(chunk_size=policy.CHUNK_SIZE, chunk_overlap=policy.CHUNK_OVERLAP,
        length_function=lambda text: len(text.encode("utf-8")), separators=["\n\n", "\n", ". ", " ", ""])
    chunks = []
    for page, text in pages:
        for content in splitter.split_text(text):
            if content.strip():
                chunks.append(dict(chunk_index=len(chunks), content=content, page_number=page))
                if len(chunks) > policy.MAX_CHUNKS:
                    raise AIError("too_many_chunks")
    if not chunks:
        raise AIError("no_extractable_text")
    return chunks
