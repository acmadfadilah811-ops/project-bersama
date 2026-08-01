from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Department, JournalTemplate


class JournalTemplateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = JournalTemplate.objects.filter(is_active=True).select_related(
            "default_debit_account", "default_kredit_account"
        )
        return Response([
            {
                "id": row.id,
                "name": row.name,
                "default_debit_account": row.default_debit_account_id,
                "default_kredit_account": row.default_kredit_account_id,
            }
            for row in rows
        ])


class DepartmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(list(Department.objects.filter(is_active=True).values("id", "name")))
