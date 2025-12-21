import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Download, Printer, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import html2pdf from "html2pdf.js";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VAT_OPTIONS = [
  { value: "0", label: "0%" },
  { value: "10", label: "10%" },
  { value: "21", label: "21%" },
];

const emptyMaterialRow = {
  nombre: "",
  ud: "",
  precio_coste: "", // precio de coste (columna auxiliar, no se imprime)
  margen: "30", // margen de ganancia en % (columna auxiliar)
  precio: "", // precio al público (calculado o manual)
  iva: "21",
  litros: "", // columna auxiliar
  altura: "", // columna auxiliar
  notas: "", // columna auxiliar
};

const BudgetTemplatePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const pdfRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Header fields
  const [budgetNumber, setBudgetNumber] = useState("");
  const [budgetDate, setBudgetDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [cliente, setCliente] = useState("");
  const [lugarEjecucion, setLugarEjecucion] = useState("");
  const [provincia, setProvincia] = useState("");

  // Services description
  const [serviciosDescripcion, setServiciosDescripcion] = useState("");

  // Materials table
  const [materiales, setMateriales] = useState([
    { ...emptyMaterialRow },
    { ...emptyMaterialRow },
    { ...emptyMaterialRow },
    { ...emptyMaterialRow },
    { ...emptyMaterialRow },
  ]);

  // Additional costs
  const [porte, setPorte] = useState({ ud: "1", precio: "", iva: "21" });
  const [manoObra, setManoObra] = useState({ ud: "1", precio: "", iva: "21" });

  // Cálculo de mano de obra
  const [calculoManoObra, setCalculoManoObra] = useState({
    precioHora: "",
    numOperarios: "",
    horasJornada: "",
    numDias: "",
    dietasDia: "",
    alojamientoDia: "",
    extraDia: "", // Extra por día (se multiplica por nº operarios)
  });

  // Observations
  const [observaciones, setObservaciones] = useState(
    "• Precios sin IVA.\n• Este Presupuesto tiene una vigencia de 2 meses, a partir de la fecha del mismo."
  );

  // Fetch existing budget if editing
  useEffect(() => {
    if (isEditing) {
      fetchBudget();
    } else {
      generateBudgetNumber();
    }
  }, [id]);

  const generateBudgetNumber = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0");
    setBudgetNumber(`P-${random}/${year}`);
  };

  const fetchBudget = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/budget-templates/${id}`);
      const data = response.data;
      setBudgetNumber(data.budget_number || "");
      setBudgetDate(data.budget_date || new Date().toISOString().split("T")[0]);
      setCliente(data.cliente || "");
      setLugarEjecucion(data.lugar_ejecucion || "");
      setProvincia(data.provincia || "");
      setServiciosDescripcion(data.servicios_descripcion || "");
      setMateriales(
        data.materiales?.length > 0
          ? data.materiales
          : [{ ...emptyMaterialRow }]
      );
      setPorte(data.porte || { ud: "1", precio: "", iva: "21" });
      setManoObra(data.mano_obra || { ud: "1", precio: "", iva: "21" });
      setObservaciones(data.observaciones || "");
    } catch (error) {
      console.error("Error fetching budget:", error);
      toast.error("Error al cargar el presupuesto");
    } finally {
      setLoading(false);
    }
  };

  // Calculate importe for a material row (PRECIO × UD)
  const calcularImporte = (ud, precio) => {
    const udNum = parseFloat(ud) || 0;
    const precioNum = parseFloat(precio) || 0;
    return udNum * precioNum;
  };

  // Calculate importe with IVA
  const calcularImporteConIva = (ud, precio, iva) => {
    const importe = calcularImporte(ud, precio);
    const ivaNum = parseFloat(iva) || 0;
    return importe * (1 + ivaNum / 100);
  };

  // Calculate precio from coste + margen
  const calcularPrecioDesdeCoste = (precioCoste, margen) => {
    const coste = parseFloat(precioCoste) || 0;
    const margenNum = parseFloat(margen) || 0;
    return coste * (1 + margenNum / 100);
  };

  // Calculate totals
  const calcularTotales = useCallback(() => {
    let totalBase = 0;
    let totalIva = 0;
    let totalCosteMateriales = 0;
    let totalVentaMateriales = 0;

    // Sum materials
    materiales.forEach((m) => {
      const importe = calcularImporte(m.ud, m.precio);
      const ivaAmount = importe * ((parseFloat(m.iva) || 0) / 100);
      totalBase += importe;
      totalIva += ivaAmount;
      
      // Sumar costes solo de materiales (no mano de obra)
      const costeTotal = calcularImporte(m.ud, m.precio_coste);
      totalCosteMateriales += costeTotal;
      totalVentaMateriales += importe;
    });

    // Add porte
    const porteImporte = calcularImporte(porte.ud, porte.precio);
    const porteIva = porteImporte * ((parseFloat(porte.iva) || 0) / 100);
    totalBase += porteImporte;
    totalIva += porteIva;

    // Add mano de obra
    const manoObraImporte = calcularImporte(manoObra.ud, manoObra.precio);
    const manoObraIva =
      manoObraImporte * ((parseFloat(manoObra.iva) || 0) / 100);
    totalBase += manoObraImporte;
    totalIva += manoObraIva;

    // Calcular ganancias solo sobre materiales (sin mano de obra)
    const gananciaTotal = totalVentaMateriales - totalCosteMateriales;
    const porcentajeGanancia = totalCosteMateriales > 0 ? (gananciaTotal / totalCosteMateriales) * 100 : 0;

    return {
      totalBase,
      totalIva,
      totalConIva: totalBase + totalIva,
      totalCosteMateriales,
      totalVentaMateriales,
      gananciaTotal,
      porcentajeGanancia,
    };
  }, [materiales, porte, manoObra]);

  const totales = calcularTotales();

  // Calcular total mano de obra desde la tabla de cálculo
  const calcularTotalManoObra = useCallback(() => {
    const precioHora = parseFloat(calculoManoObra.precioHora) || 0;
    const numOperarios = parseFloat(calculoManoObra.numOperarios) || 0;
    const horasJornada = parseFloat(calculoManoObra.horasJornada) || 0;
    const numDias = parseFloat(calculoManoObra.numDias) || 0;
    const dietasDia = parseFloat(calculoManoObra.dietasDia) || 0;
    const alojamientoDia = parseFloat(calculoManoObra.alojamientoDia) || 0;
    const extraDia = parseFloat(calculoManoObra.extraDia) || 0;

    // Total horas normales = precio hora × nº horas × nº operarios × nº días
    const totalHorasNormales = precioHora * horasJornada * numOperarios * numDias;
    
    // Total dietas = dietas × nº días × nº operarios
    const totalDietas = dietasDia * numDias * numOperarios;
    
    // Total alojamiento = alojamiento × nº días × nº operarios
    const totalAlojamiento = alojamientoDia * numDias * numOperarios;
    
    // Total extra = extra por día × nº operarios
    const totalExtra = extraDia * numOperarios;

    return {
      totalHorasNormales,
      totalDietas,
      totalAlojamiento,
      totalExtra,
      total: totalHorasNormales + totalDietas + totalAlojamiento + totalExtra,
    };
  }, [calculoManoObra]);

  const totalesManoObra = calcularTotalManoObra();

  // Actualizar mano de obra cuando cambie el cálculo
  const handleCalculoManoObraChange = (field, value) => {
    const newCalculo = { ...calculoManoObra, [field]: value };
    setCalculoManoObra(newCalculo);
    
    // Recalcular y actualizar el precio de mano de obra
    const precioHora = parseFloat(field === "precioHora" ? value : newCalculo.precioHora) || 0;
    const numOperarios = parseFloat(field === "numOperarios" ? value : newCalculo.numOperarios) || 0;
    const horasJornada = parseFloat(field === "horasJornada" ? value : newCalculo.horasJornada) || 0;
    const numDias = parseFloat(field === "numDias" ? value : newCalculo.numDias) || 0;
    const dietasDia = parseFloat(field === "dietasDia" ? value : newCalculo.dietasDia) || 0;
    const alojamientoDia = parseFloat(field === "alojamientoDia" ? value : newCalculo.alojamientoDia) || 0;
    const extraDia = parseFloat(field === "extraDia" ? value : newCalculo.extraDia) || 0;

    const totalHorasNormales = precioHora * horasJornada * numOperarios * numDias;
    const totalDietas = dietasDia * numDias * numOperarios;
    const totalAlojamiento = alojamientoDia * numDias * numOperarios;
    const totalExtra = extraDia * numOperarios;
    const total = totalHorasNormales + totalDietas + totalAlojamiento + totalExtra;

    // Actualizar mano de obra con el total calculado
    if (total > 0) {
      setManoObra({ ...manoObra, ud: "1", precio: total.toFixed(2) });
    }
  };

  // Handle material row change
  const handleMaterialChange = (index, field, value) => {
    const newMateriales = [...materiales];
    newMateriales[index] = { ...newMateriales[index], [field]: value };
    
    // If changing precio_coste or margen, auto-calculate precio
    if (field === "precio_coste" || field === "margen") {
      const precioCoste = field === "precio_coste" ? value : newMateriales[index].precio_coste;
      const margen = field === "margen" ? value : newMateriales[index].margen;
      if (precioCoste) {
        newMateriales[index].precio = calcularPrecioDesdeCoste(precioCoste, margen).toFixed(2);
      }
    }
    
    setMateriales(newMateriales);
  };

  // Add material row
  const addMaterialRow = () => {
    setMateriales([...materiales, { ...emptyMaterialRow }]);
  };

  // Remove material row
  const removeMaterialRow = (index) => {
    if (materiales.length > 1) {
      const newMateriales = materiales.filter((_, i) => i !== index);
      setMateriales(newMateriales);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Save budget
  const handleSave = async () => {
    if (!cliente.trim()) {
      toast.error("El campo Cliente es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        budget_number: budgetNumber,
        budget_date: budgetDate,
        cliente,
        lugar_ejecucion: lugarEjecucion,
        provincia,
        servicios_descripcion: serviciosDescripcion,
        materiales: materiales.filter((m) => m.nombre.trim() !== ""),
        porte,
        mano_obra: manoObra,
        observaciones,
        total_base: totales.totalBase,
        total_iva: totales.totalIva,
        total_con_iva: totales.totalConIva,
      };

      if (isEditing) {
        await axios.put(`${API}/budget-templates/${id}`, payload);
        toast.success("Presupuesto actualizado correctamente");
      } else {
        await axios.post(`${API}/budget-templates`, payload);
        toast.success("Presupuesto creado correctamente");
      }
      navigate("/budgets");
    } catch (error) {
      console.error("Error saving budget:", error);
      toast.error("Error al guardar el presupuesto");
    } finally {
      setSaving(false);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    const element = pdfRef.current;
    
    // Ocultar columnas auxiliares temporalmente
    const auxElements = element.querySelectorAll('[data-pdf-hide="true"]');
    auxElements.forEach(el => {
      el.style.display = 'none';
    });
    
    const opt = {
      margin: [10, 15, 10, 15],
      filename: `Presupuesto_${budgetNumber.replace(/\//g, '-')}_${cliente.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    toast.info("Generando PDF...");
    
    try {
      await html2pdf().set(opt).from(element).save();
      toast.success("PDF generado correctamente");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Error al generar el PDF");
    } finally {
      // Restaurar columnas auxiliares
      auxElements.forEach(el => {
        el.style.display = '';
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div data-testid="budget-template-page" className="max-w-7xl mx-auto">
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Button
          variant="ghost"
          onClick={() => navigate("/budgets")}
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.print()}
            data-testid="print-btn"
          >
            <Printer className="w-4 h-4 mr-2" />
            Vista previa / Imprimir
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            data-testid="export-pdf-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700"
            data-testid="save-template-btn"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {/* Budget Template */}
      <div ref={pdfRef}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-lg shadow-sm p-8"
        >
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600 font-['Manrope']">
              PRESUPUESTO
            </h1>
            <p className="text-slate-500 text-sm mt-1">Documento comercial</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-slate-600">Presupuesto:</span>
              <Input
                value={budgetNumber}
                onChange={(e) => setBudgetNumber(e.target.value)}
                className="w-32 text-right font-mono text-sm"
                data-testid="budget-number-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Fecha:</span>
              <Input
                type="date"
                value={budgetDate}
                onChange={(e) => setBudgetDate(e.target.value)}
                className="w-40 text-sm"
                data-testid="budget-date-input"
              />
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-1 gap-4 mb-8 bg-slate-50 p-4 rounded-lg print:bg-white print:border print:border-slate-200">
          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Cliente</label>
            <Input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
              className="bg-white"
              data-testid="cliente-input"
            />
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-sm font-medium text-slate-700">
              Lugar de ejecución
            </label>
            <Input
              value={lugarEjecucion}
              onChange={(e) => setLugarEjecucion(e.target.value)}
              placeholder="Dirección del proyecto"
              className="bg-white"
              data-testid="lugar-input"
            />
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Provincia</label>
            <Input
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              placeholder="Provincia"
              className="bg-white"
              data-testid="provincia-input"
            />
          </div>
        </div>

        {/* Services Description */}
        <div className="mb-8">
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-t-lg font-medium">
            DESCRIPCIÓN DE LOS SERVICIOS
          </div>
          <div className="border border-t-0 border-slate-200 rounded-b-lg p-4">
            <Textarea
              value={serviciosDescripcion}
              onChange={(e) => setServiciosDescripcion(e.target.value)}
              placeholder="Descripción detallada de los servicios a realizar..."
              rows={3}
              className="resize-none"
              data-testid="servicios-textarea"
            />
          </div>
        </div>

        {/* Materials Table */}
        <div className="mb-8">
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-t-lg font-medium flex items-center justify-between">
            <span>DESCRIPCIÓN DE LOS MATERIALES</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addMaterialRow}
              className="text-white hover:bg-indigo-500 print:hidden" data-pdf-hide="true"
              data-testid="add-material-btn"
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir fila
            </Button>
          </div>
          <div className="border border-t-0 border-slate-200 rounded-b-lg overflow-x-auto">
            <table className="w-full" data-testid="materials-table">
              <thead className="bg-slate-100">
                <tr>
                  {/* Columnas principales (se imprimen) */}
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase w-[22%]">
                    NOMBRE
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 uppercase w-[5%]">
                    UD
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600 uppercase w-[8%]">
                    PRECIO
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600 uppercase w-[9%]">
                    PRECIO SIN IVA
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 uppercase w-[5%]">
                    I.V.A
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600 uppercase w-[10%]">
                    PRECIO CON IVA
                  </th>
                  
                  {/* Columnas auxiliares (NO se imprimen) - separador visual */}
                  <th className="px-1 py-2 bg-slate-200 w-[1px] print:hidden" data-pdf-hide="true"></th>
                  
                  {/* Columnas en minúscula - solo edición */}
                  <th className="px-2 py-2 text-right text-xs font-normal text-slate-500 lowercase w-[7%] print:hidden bg-amber-50" data-pdf-hide="true">
                    precio coste
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-normal text-slate-500 lowercase w-[7%] print:hidden bg-amber-50" data-pdf-hide="true">
                    coste total
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-normal text-slate-500 lowercase w-[5%] print:hidden bg-amber-50" data-pdf-hide="true">
                    margen %
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-normal text-slate-500 lowercase w-[5%] print:hidden bg-amber-50" data-pdf-hide="true">
                    litros
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-normal text-slate-500 lowercase w-[5%] print:hidden bg-amber-50" data-pdf-hide="true">
                    altura
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-normal text-slate-500 lowercase w-[10%] print:hidden bg-amber-50" data-pdf-hide="true">
                    notas
                  </th>
                  <th className="px-2 py-2 w-[3%] print:hidden" data-pdf-hide="true"></th>
                </tr>
              </thead>
              <tbody>
                {materiales.map((material, index) => {
                  const importe = calcularImporte(material.ud, material.precio);
                  const importeConIva = calcularImporteConIva(
                    material.ud,
                    material.precio,
                    material.iva
                  );
                  const costeTotal = calcularImporte(material.ud, material.precio_coste);
                  return (
                    <tr
                      key={index}
                      className="border-t border-slate-100 hover:bg-slate-50"
                      data-testid={`material-row-${index}`}
                    >
                      {/* Columnas principales */}
                      <td className="px-1 py-1">
                        <Input
                          value={material.nombre}
                          onChange={(e) =>
                            handleMaterialChange(index, "nombre", e.target.value)
                          }
                          placeholder="Nombre del material"
                          className="border-0 bg-transparent h-8 text-sm"
                          data-testid={`material-nombre-${index}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          value={material.ud}
                          onChange={(e) =>
                            handleMaterialChange(index, "ud", e.target.value)
                          }
                          placeholder="0"
                          className="border-0 bg-transparent h-8 text-sm text-center"
                          type="number"
                          min="0"
                          step="1"
                          data-testid={`material-ud-${index}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          value={material.precio}
                          onChange={(e) =>
                            handleMaterialChange(index, "precio", e.target.value)
                          }
                          placeholder="0,00"
                          className="border-0 bg-transparent h-8 text-sm text-right font-mono"
                          type="number"
                          min="0"
                          step="0.01"
                          data-testid={`material-precio-${index}`}
                        />
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-sm text-slate-700">
                        {formatCurrency(importe)} €
                      </td>
                      <td className="px-1 py-1">
                        <Select
                          value={material.iva}
                          onValueChange={(value) =>
                            handleMaterialChange(index, "iva", value)
                          }
                        >
                          <SelectTrigger
                            className="border-0 bg-transparent h-8 text-sm"
                            data-testid={`material-iva-${index}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-sm text-slate-900 font-medium">
                        {formatCurrency(importeConIva)} €
                      </td>
                      
                      {/* Separador */}
                      <td className="bg-slate-200 print:hidden" data-pdf-hide="true"></td>
                      
                      {/* Columnas auxiliares (NO se imprimen) */}
                      <td className="px-1 py-1 bg-amber-50 print:hidden" data-pdf-hide="true">
                        <Input
                          value={material.precio_coste || ""}
                          onChange={(e) =>
                            handleMaterialChange(index, "precio_coste", e.target.value)
                          }
                          placeholder="0,00"
                          className="border-0 bg-transparent h-8 text-sm text-right font-mono"
                          type="number"
                          min="0"
                          step="0.01"
                          data-testid={`material-coste-${index}`}
                        />
                      </td>
                      <td className="px-2 py-1 bg-amber-50 print:hidden text-right font-mono text-sm text-slate-700" data-pdf-hide="true">
                        {costeTotal > 0 ? `${formatCurrency(costeTotal)} €` : ""}
                      </td>
                      <td className="px-1 py-1 bg-amber-50 print:hidden" data-pdf-hide="true">
                        <Input
                          value={material.margen || "30"}
                          onChange={(e) =>
                            handleMaterialChange(index, "margen", e.target.value)
                          }
                          placeholder="30"
                          className="border-0 bg-transparent h-8 text-sm text-center"
                          type="number"
                          min="0"
                          step="1"
                          data-testid={`material-margen-${index}`}
                        />
                      </td>
                      <td className="px-1 py-1 bg-amber-50 print:hidden" data-pdf-hide="true">
                        <Input
                          value={material.litros || ""}
                          onChange={(e) =>
                            handleMaterialChange(index, "litros", e.target.value)
                          }
                          placeholder="0"
                          className="border-0 bg-transparent h-8 text-sm text-center"
                          type="number"
                          min="0"
                          step="0.1"
                          data-testid={`material-litros-${index}`}
                        />
                      </td>
                      <td className="px-1 py-1 bg-amber-50 print:hidden" data-pdf-hide="true">
                        <Input
                          value={material.altura || ""}
                          onChange={(e) =>
                            handleMaterialChange(index, "altura", e.target.value)
                          }
                          placeholder="0"
                          className="border-0 bg-transparent h-8 text-sm text-center"
                          type="number"
                          min="0"
                          step="0.1"
                          data-testid={`material-altura-${index}`}
                        />
                      </td>
                      <td className="px-1 py-1 bg-amber-50 print:hidden" data-pdf-hide="true">
                        <Input
                          value={material.notas || ""}
                          onChange={(e) =>
                            handleMaterialChange(index, "notas", e.target.value)
                          }
                          placeholder="Notas..."
                          className="border-0 bg-transparent h-8 text-sm"
                          data-testid={`material-notas-${index}`}
                        />
                      </td>
                      <td className="px-1 py-1 print:hidden" data-pdf-hide="true">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMaterialRow(index)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                          disabled={materiales.length <= 1}
                          data-testid={`remove-material-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {/* Porte Row */}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-2 py-2 font-medium text-slate-700">Porte</td>
                  <td className="px-1 py-1">
                    <Input
                      value={porte.ud}
                      onChange={(e) =>
                        setPorte({ ...porte, ud: e.target.value })
                      }
                      className="border-0 bg-transparent h-8 text-sm text-center"
                      type="number"
                      min="0"
                      data-testid="porte-ud"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={porte.precio}
                      onChange={(e) =>
                        setPorte({ ...porte, precio: e.target.value })
                      }
                      placeholder="0,00"
                      className="border-0 bg-transparent h-8 text-sm text-right font-mono"
                      type="number"
                      min="0"
                      step="0.01"
                      data-testid="porte-precio"
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-sm text-slate-700">
                    {formatCurrency(calcularImporte(porte.ud, porte.precio))} €
                  </td>
                  <td className="px-1 py-1">
                    <Select
                      value={porte.iva}
                      onValueChange={(value) =>
                        setPorte({ ...porte, iva: value })
                      }
                    >
                      <SelectTrigger
                        className="border-0 bg-transparent h-8 text-sm"
                        data-testid="porte-iva"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VAT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-sm text-slate-900 font-medium">
                    {formatCurrency(
                      calcularImporteConIva(porte.ud, porte.precio, porte.iva)
                    )}{" "}
                    €
                  </td>
                  {/* Celdas vacías para columnas auxiliares */}
                  <td className="bg-slate-200 print:hidden" data-pdf-hide="true"></td>
                  <td colSpan="6" className="bg-amber-50/50 print:hidden" data-pdf-hide="true"></td>
                  <td className="print:hidden"></td>
                </tr>

                {/* Mano de Obra Row */}
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-2 py-2 font-medium text-slate-700">
                    Mano de obra
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={manoObra.ud}
                      onChange={(e) =>
                        setManoObra({ ...manoObra, ud: e.target.value })
                      }
                      className="border-0 bg-transparent h-8 text-sm text-center"
                      type="number"
                      min="0"
                      data-testid="mano-obra-ud"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={manoObra.precio}
                      onChange={(e) =>
                        setManoObra({ ...manoObra, precio: e.target.value })
                      }
                      placeholder="0,00"
                      className="border-0 bg-transparent h-8 text-sm text-right font-mono"
                      type="number"
                      min="0"
                      step="0.01"
                      data-testid="mano-obra-precio"
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-sm text-slate-700">
                    {formatCurrency(
                      calcularImporte(manoObra.ud, manoObra.precio)
                    )}{" "}
                    €
                  </td>
                  <td className="px-1 py-1">
                    <Select
                      value={manoObra.iva}
                      onValueChange={(value) =>
                        setManoObra({ ...manoObra, iva: value })
                      }
                    >
                      <SelectTrigger
                        className="border-0 bg-transparent h-8 text-sm"
                        data-testid="mano-obra-iva"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VAT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-sm text-slate-900 font-medium">
                    {formatCurrency(
                      calcularImporteConIva(
                        manoObra.ud,
                        manoObra.precio,
                        manoObra.iva
                      )
                    )}{" "}
                    €
                  </td>
                  {/* Celdas vacías para columnas auxiliares */}
                  <td className="bg-slate-200 print:hidden" data-pdf-hide="true"></td>
                  <td colSpan="6" className="bg-amber-50/50 print:hidden" data-pdf-hide="true"></td>
                  <td className="print:hidden" data-pdf-hide="true"></td>
                </tr>

                {/* Fila de TOTALES dentro de la tabla */}
                <tr className="border-t-2 border-slate-300 bg-slate-100">
                  <td colSpan="3" className="px-2 py-3 text-right font-semibold text-slate-700">
                    TOTALES:
                  </td>
                  <td className="px-2 py-3 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(totales.totalBase)} €
                  </td>
                  <td className="px-2 py-3"></td>
                  <td className="px-2 py-3 text-right font-mono font-bold text-indigo-600 text-lg">
                    {formatCurrency(totales.totalConIva)} €
                  </td>
                  <td className="bg-slate-200 print:hidden" data-pdf-hide="true"></td>
                  <td colSpan="6" className="bg-amber-100 print:hidden text-right px-2 font-mono font-semibold text-slate-700" data-pdf-hide="true">
                    {formatCurrency(totales.totalCosteMateriales)} €
                  </td>
                  <td className="print:hidden" data-pdf-hide="true"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen de totales para PDF */}
        <div className="flex justify-end mb-8">
          <div className="w-80 space-y-2">
            <div className="flex justify-between py-2 border-b border-slate-200">
              <span className="font-medium text-slate-700">TOTAL PRESUPUESTO (sin IVA)</span>
              <span
                className="font-mono font-medium text-slate-900"
                data-testid="total-base"
              >
                {formatCurrency(totales.totalBase)} €
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-200">
              <span className="text-slate-600">+ I.V.A</span>
              <span
                className="font-mono text-slate-700"
                data-testid="total-iva"
              >
                {formatCurrency(totales.totalIva)} €
              </span>
            </div>
            <div className="flex justify-between py-3 bg-indigo-50 px-3 rounded-lg">
              <span className="font-bold text-indigo-900">TOTAL IVA INCLUIDO</span>
              <span
                className="font-mono font-bold text-indigo-600 text-lg"
                data-testid="total-con-iva"
              >
                {formatCurrency(totales.totalConIva)} €
              </span>
            </div>
          </div>
        </div>

        {/* Sección de CÁLCULO MANO DE OBRA - NO aparece en PDF */}
        <div className="mb-8 print:hidden" data-pdf-hide="true">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              CÁLCULO MANO DE OBRA (no aparece en PDF)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-blue-800">Concepto</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-blue-800">Valor</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-blue-800">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  <tr className="bg-white">
                    <td className="px-3 py-2 text-slate-700">Precio hora de trabajo/operario</td>
                    <td className="px-3 py-2">
                      <Input
                        value={calculoManoObra.precioHora}
                        onChange={(e) => handleCalculoManoObraChange("precioHora", e.target.value)}
                        placeholder="0,00"
                        className="w-24 text-center text-sm h-8 mx-auto"
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid="calculo-precio-hora"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">-</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2 text-slate-700">Nº operarios</td>
                    <td className="px-3 py-2">
                      <Input
                        value={calculoManoObra.numOperarios}
                        onChange={(e) => handleCalculoManoObraChange("numOperarios", e.target.value)}
                        placeholder="0"
                        className="w-24 text-center text-sm h-8 mx-auto"
                        type="number"
                        min="0"
                        data-testid="calculo-num-operarios"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">-</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2 text-slate-700">Nº horas por jornada/operario</td>
                    <td className="px-3 py-2">
                      <Input
                        value={calculoManoObra.horasJornada}
                        onChange={(e) => handleCalculoManoObraChange("horasJornada", e.target.value)}
                        placeholder="0"
                        className="w-24 text-center text-sm h-8 mx-auto"
                        type="number"
                        min="0"
                        data-testid="calculo-horas-jornada"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">-</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2 text-slate-700">Nº días</td>
                    <td className="px-3 py-2">
                      <Input
                        value={calculoManoObra.numDias}
                        onChange={(e) => handleCalculoManoObraChange("numDias", e.target.value)}
                        placeholder="0"
                        className="w-24 text-center text-sm h-8 mx-auto"
                        type="number"
                        min="0"
                        data-testid="calculo-num-dias"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-900">
                      {formatCurrency(totalesManoObra.totalHorasNormales)} €
                    </td>
                  </tr>
                  <tr className="bg-blue-50/50">
                    <td className="px-3 py-2 text-slate-700">Dietas (por día/operario)</td>
                    <td className="px-3 py-2">
                      <Input
                        value={calculoManoObra.dietasDia}
                        onChange={(e) => handleCalculoManoObraChange("dietasDia", e.target.value)}
                        placeholder="0,00"
                        className="w-24 text-center text-sm h-8 mx-auto"
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid="calculo-dietas"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-900">
                      {formatCurrency(totalesManoObra.totalDietas)} €
                    </td>
                  </tr>
                  <tr className="bg-blue-50/50">
                    <td className="px-3 py-2 text-slate-700">Alojamiento (por día/operario)</td>
                    <td className="px-3 py-2">
                      <Input
                        value={calculoManoObra.alojamientoDia}
                        onChange={(e) => handleCalculoManoObraChange("alojamientoDia", e.target.value)}
                        placeholder="0,00"
                        className="w-24 text-center text-sm h-8 mx-auto"
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid="calculo-alojamiento"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-900">
                      {formatCurrency(totalesManoObra.totalAlojamiento)} €
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2 text-slate-700">Extra por día</td>
                    <td className="px-3 py-2">
                      <Input
                        value={calculoManoObra.extraDia}
                        onChange={(e) => handleCalculoManoObraChange("extraDia", e.target.value)}
                        placeholder="0,00"
                        className="w-24 text-center text-sm h-8 mx-auto"
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid="calculo-extra-dia"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-900">
                      {formatCurrency(totalesManoObra.totalExtra)} €
                    </td>
                  </tr>
                  <tr className="bg-blue-200 font-semibold">
                    <td colSpan="2" className="px-3 py-3 text-blue-900 text-right">
                      TOTAL MANO DE OBRA →
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-blue-900 text-lg">
                      {formatCurrency(totalesManoObra.total)} €
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sección de GANANCIAS - NO aparece en PDF */}
        <div className="mb-8 print:hidden" data-pdf-hide="true">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              RESUMEN DE GANANCIAS (no aparece en PDF)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <p className="text-xs text-slate-500 uppercase">Coste Materiales</p>
                <p className="font-mono font-semibold text-slate-900">{formatCurrency(totales.totalCosteMateriales)} €</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <p className="text-xs text-slate-500 uppercase">Venta Materiales (sin IVA)</p>
                <p className="font-mono font-semibold text-slate-900">{formatCurrency(totales.totalVentaMateriales)} €</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <p className="text-xs text-slate-500 uppercase">Ganancia Materiales</p>
                <p className="font-mono font-semibold text-green-600">{formatCurrency(totales.gananciaTotal)} €</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3 border border-green-200">
                <p className="text-xs text-green-700 uppercase font-medium">Margen de Ganancia</p>
                <p className="font-mono font-bold text-green-700 text-xl">{totales.porcentajeGanancia.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Observations */}
        <div className="mb-8">
          <div className="bg-orange-100 border border-orange-200 rounded-lg p-4 print:bg-white print:border-slate-200">
            <h3 className="font-semibold text-orange-800 mb-2 print:text-slate-800">
              * OBSERVACIONES
            </h3>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="resize-none bg-white border-orange-200 print:border-slate-200"
              data-testid="observaciones-textarea"
            />
          </div>
        </div>

        {/* Footer / Signature */}
        <div className="border-t border-slate-200 pt-6 text-center">
          <p className="text-slate-600 mb-4">
            Fdo. _________________________
          </p>
          <p className="text-sm text-slate-500">Director Gerente</p>
        </div>
      </motion.div>
      </div>
    </div>
  );
};

export default BudgetTemplatePage;
