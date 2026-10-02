from rest_framework.pagination import PageNumberPagination


class CollectionPagination(PageNumberPagination):
    """Bounded pages inside the existing frontend's named collection envelope."""
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100

    def envelope(self, *, key, rows, **metadata):
        return {**metadata, key: rows, "count": self.page.paginator.count,
                "next": self.get_next_link(), "previous": self.get_previous_link()}
