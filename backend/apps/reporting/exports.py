import csv
from datetime import date, datetime
from decimal import Decimal
from tempfile import TemporaryFile
from django.http import StreamingHttpResponse, FileResponse
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Font

MIMES = {"csv": "text/csv; charset=utf-8", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}


def cell_value(value):
    if value is None:
        return ""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, bool):
        return "Oui" if value else "Non"
    text = str(value)
    if isinstance(value, str) and text.lstrip().startswith(("=", "+", "-", "@")):
        text = "'" + text
    # XML 1.0 forbidden controls are removed; tabs/newlines remain valid CSV text.
    return "".join(c for c in text if ord(c) >= 32 or c in "\t\r\n")


class Echo:
    def write(self, value):
        return value


def csv_chunks(headers, rows):
    writer = csv.writer(Echo(), delimiter=";", lineterminator="\r\n")
    yield "\ufeff".encode("utf-8")
    yield writer.writerow(headers).encode("utf-8")
    for row in rows:
        yield writer.writerow([cell_value(value) for value in row]).encode("utf-8")


def export_file(headers, rows, format):
    stream = TemporaryFile(mode="w+b")
    try:
        if format == "csv":
            for chunk in csv_chunks(headers, rows):
                stream.write(chunk)
        else:
            book = Workbook(write_only=True)
            sheet, count, number = None, 0, 0
            for row in (None,):
                # Create the header even for an empty dataset.
                number += 1
                sheet = book.create_sheet(f"Données {number}")
                cells = [WriteOnlyCell(sheet, value=header) for header in headers]
                for cell in cells:
                    cell.font = Font(bold=True)
                sheet.append(cells)
                count = 1
            for row in rows:
                if count == 1_048_576:
                    number += 1
                    sheet = book.create_sheet(f"Données {number}")
                    sheet.append(list(headers))
                    count = 1
                # Exact decimals are text: Excel binary numbers would lose financial precision.
                cells = [WriteOnlyCell(sheet, value=cell_value(value)) for value in row]
                for cell in cells:
                    cell.data_type = "s"
                sheet.append(cells)
                count += 1
            book.save(stream)
            book.close()
        stream.seek(0)
        return stream
    except Exception:
        stream.close()
        raise


def export_response(headers, rows, format, filename):
    if format == "csv":
        response = StreamingHttpResponse(csv_chunks(headers, rows), content_type=MIMES[format])
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
    else:
        response = FileResponse(export_file(headers, rows, format), as_attachment=True, filename=filename, content_type=MIMES[format])
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
