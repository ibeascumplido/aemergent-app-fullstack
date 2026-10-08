"""Lee un Excel de presupuesto de Inicia y devuelve los datos con el mismo
formato que usa el formulario de presupuestos de la app.

No depende de celdas fijas: localiza las etiquetas ("Cliente", "Lugar de
ejecucion", "NOMBRE"...) y lee los valores relativos a ellas, así que
funciona aunque las filas se desplacen un poco.
"""
import io
import re
import unicodedata
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import openpyxl

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}


def _norm(v: Any) -> str:
    if v is None:
        return ""
    s = unicodedata.normalize("NFKD", str(v))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().lower()


def _txt(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def _num(v: Any) -> Optional[float]:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip().replace(",", "."))
        except ValueError:
            return None
    return None


def _fmt(n: Optional[float], dec: int = 4) -> str:
    if n is None:
        return ""
    r = round(n, dec)
    if r == int(r):
        return str(int(r))
    return str(r)


def _valor_a_la_derecha(ws, fila: int, col: int, solo_numero: bool = False):
    for c in range(col + 1, ws.max_column + 1):
        v = ws.cell(row=fila, column=c).value
        if v is None or (isinstance(v, str) and not v.strip()):
            continue
        if solo_numero and _num(v) is None:
            continue
        return v
    return None


def parse_presupuesto_excel(contenido: bytes) -> Dict[str, Any]:
    wb_v = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
    wb_f = openpyxl.load_workbook(io.BytesIO(contenido), data_only=False)
    ws = wb_v.worksheets[0]
    wsf = wb_f.worksheets[0]
    avisos: List[str] = []

    # --- Localizar etiquetas ------------------------------------------------
    etiquetas: Dict[str, tuple] = {}
    for row in ws.iter_rows():
        for c in row:
            n = _norm(c.value)
            if n and n not in etiquetas:
                etiquetas[n] = (c.row, c.column)

    def buscar(*claves) -> Optional[tuple]:
        for k in claves:
            if k in etiquetas:
                return etiquetas[k]
        return None

    out: Dict[str, Any] = {}

    # --- Nº presupuesto y fecha --------------------------------------------
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str):
                m = re.match(r"\s*presupuesto\s*:\s*(\S+)", c.value, re.I)
                if m and "budget_number" not in out:
                    out["budget_number"] = m.group(1).strip()
                m = re.match(r"\s*fecha\s*:\s*(.+)$", c.value, re.I)
                if m and "budget_date" not in out:
                    txt = _norm(m.group(1))
                    mm = re.match(r"(\d{1,2})\s*(?:de\s*)?([a-z]+)\s*(?:de\s*)?(\d{4})", txt)
                    if mm and mm.group(2) in MESES:
                        out["budget_date"] = date(
                            int(mm.group(3)), MESES[mm.group(2)], int(mm.group(1))
                        ).isoformat()
                    else:
                        mm = re.match(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", txt)
                        if mm:
                            y = int(mm.group(3))
                            y = y + 2000 if y < 100 else y
                            try:
                                out["budget_date"] = date(y, int(mm.group(2)), int(mm.group(1))).isoformat()
                            except ValueError:
                                pass
            elif isinstance(c.value, (datetime, date)) and "budget_date" not in out:
                pass  # una fecha suelta no se usa: solo la de "Fecha:"
    if "budget_date" not in out:
        avisos.append("No se pudo leer la fecha del presupuesto.")
    if "budget_number" not in out:
        avisos.append("No se pudo leer el número de presupuesto.")

    # --- Cliente / lugar / provincia ----------------------------------------
    for clave, campo in (
        (("cliente",), "cliente"),
        (("lugar de ejecucion", "lugar ejecucion", "lugar"), "lugar_ejecucion"),
        (("provincia",), "provincia"),
    ):
        pos = buscar(*clave)
        if pos:
            v = _valor_a_la_derecha(ws, pos[0], pos[1])
            out[campo] = _txt(v)
        else:
            avisos.append(f"No se encontró «{clave[0]}».")

    # --- Cabecera de materiales (define el ancho de la tabla) ---------------
    hdr = buscar("nombre")
    if not hdr:
        avisos.append("No se encontró la tabla de materiales (columna NOMBRE).")
        out["materiales"] = []
        out["avisos"] = avisos
        return out
    hdr_row, col_nombre = hdr
    fila_hdr = {_norm(ws.cell(row=hdr_row, column=c).value): c for c in range(1, ws.max_column + 1)
                if ws.cell(row=hdr_row, column=c).value is not None}
    col_ud = fila_hdr.get("ud")
    col_precio = fila_hdr.get("precio")
    col_iva = fila_hdr.get("i.v.a") or fila_hdr.get("iva")
    col_ancho = max([c for c in (col_nombre, col_ud, col_precio, col_iva, fila_hdr.get("importe")) if c] or [col_nombre])

    # Título (barra azul): primer texto sobre "Cliente" dentro del ancho de la tabla
    pos_cli = buscar("cliente")
    fila_limite = pos_cli[0] if pos_cli else hdr_row
    titulo = ""
    for r in range(1, fila_limite):
        for c in range(1, col_ancho + 1):
            v = ws.cell(row=r, column=c).value
            t = _txt(v)
            if t and not re.match(r"(presupuesto|fecha|pag)", _norm(t)):
                titulo = t
                break
        if titulo:
            break
    if titulo:
        out["titulo"] = titulo

    # Descripción de los servicios
    pos_serv = buscar("descripcion de los servicios")
    if pos_serv:
        textos = []
        for r in range(pos_serv[0] + 1, hdr_row - 1):
            if _norm(ws.cell(row=r, column=col_nombre).value).startswith("descripcion de los materiales"):
                break
            for c in range(1, col_ancho + 1):
                t = _txt(ws.cell(row=r, column=c).value)
                if t:
                    textos.append(t)
                    break
        out["servicios_descripcion"] = "\n".join(textos)

    # --- Materiales -----------------------------------------------------------
    # Segunda fila de cabecera (precio / horas / litros / altura) cerca de la primera
    col_coste = col_litros = col_altura = None
    for r in range(hdr_row, hdr_row + 4):
        for c in range(col_ancho + 1, ws.max_column + 1):
            n = _norm(ws.cell(row=r, column=c).value)
            if n == "precio" and not col_coste:
                col_coste = c
            elif n == "litros" and not col_litros:
                col_litros = c
            elif n == "altura" and not col_altura:
                col_altura = c
    if not col_coste:
        avisos.append("No se encontró la columna de precio de coste: se usará el precio de venta.")
    col_notas = (col_altura + 1) if col_altura else None

    fin = None
    for k in ("total coste materiales", "total precio venta materiales", "total presupuesto"):
        pos = buscar(k)
        if pos:
            fin = pos[0] if fin is None else min(fin, pos[0])
    fin = fin or ws.max_row + 1

    def margen_de_fila(r: int, coste: Optional[float], venta: Optional[float]) -> float:
        if coste and venta and coste > 0:
            return round((venta / coste - 1) * 100, 2)
        f = wsf.cell(row=r, column=col_precio).value if col_precio else None
        if isinstance(f, str):
            m = re.search(r"PRODUCT\(\s*[A-Z]+\d+\s*,\s*([0-9.]+)\s*\)", f, re.I)
            if m:
                return round(float(m.group(1)) * 100, 2)
        return 30.0

    def iva_de(v: Any) -> str:
        n = _num(v)
        if n is None:
            return "21"
        return _fmt(n * 100 if n <= 1 else n, 2)

    materiales: List[Dict[str, str]] = []
    porte = None
    mano_obra = None
    for r in range(hdr_row + 1, fin):
        nombre = _txt(ws.cell(row=r, column=col_nombre).value)
        if not nombre:
            continue
        ud = _num(ws.cell(row=r, column=col_ud).value) if col_ud else None
        venta = _num(ws.cell(row=r, column=col_precio).value) if col_precio else None
        coste = _num(ws.cell(row=r, column=col_coste).value) if col_coste else None
        iva = iva_de(ws.cell(row=r, column=col_iva).value) if col_iva else "21"
        margen = margen_de_fila(r, coste, venta)
        n = _norm(nombre)
        if n.startswith("porte"):
            porte = {
                "ud": _fmt(ud) or "1", "precio": _fmt(venta), "iva": iva,
                "precio_coste": _fmt(coste if coste is not None else venta),
                "margen": _fmt(margen, 2),
            }
            continue
        if "mano de obra" in n:
            mano_obra = {"ud": _fmt(ud) or "1", "precio": _fmt(venta), "iva": iva}
            continue
        if coste is None and venta is not None:
            coste = venta / (1 + margen / 100) if margen > -100 else venta
        materiales.append({
            "nombre": nombre,
            "ud": _fmt(ud),
            "precio_coste": _fmt(coste),
            "margen": _fmt(margen, 2),
            "precio": _fmt(venta),
            "iva": iva,
            "litros": _txt(ws.cell(row=r, column=col_litros).value) if col_litros else "",
            "altura": _txt(ws.cell(row=r, column=col_altura).value) if col_altura else "",
            "notas": _txt(ws.cell(row=r, column=col_notas).value) if col_notas else "",
        })
    out["materiales"] = materiales
    if porte:
        out["porte"] = porte
    if mano_obra:
        out["mano_obra"] = mano_obra
    if not materiales:
        avisos.append("No se encontró ninguna línea de materiales con nombre.")

    # --- Cálculo de horas de jardinería externa -----------------------------
    campos = {
        "precioHora": ("precio hora de trabajo/operario",),
        "numOperarios": ("n° operarios", "nº operarios", "no operarios", "n operarios"),
        "horasJornada": ("n° horas por jornada/operario", "nº horas por jornada/operario"),
        "numDias": ("n° dias", "nº dias"),
        "dietasDia": ("dietas (por dia/operario)",),
        "alojamientoDia": ("alojamiento (por dia/operario)",),
    }
    calculo: Dict[str, str] = {}
    algun_valor = False
    for campo, claves in campos.items():
        pos = None
        for k, p in etiquetas.items():
            if any(k.replace("º", "°") == c.replace("º", "°") for c in claves):
                pos = p
                break
        val = None
        if pos:
            val = _num(_valor_a_la_derecha(ws, pos[0], pos[1], solo_numero=True))
        calculo[campo] = _fmt(val) if val else ""
        algun_valor = algun_valor or bool(val)
    if algun_valor:
        calculo["extraDia"] = ""
        out["calculo_mano_obra"] = calculo

    out["avisos"] = avisos
    return out
