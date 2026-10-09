import React, { useState } from 'react';
import {
  Tag,
  PlusCircle,
  Edit2,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { ATTPlan } from '../types/pricing';
import {
  addCustomPlan,
  updatePlanPrice,
  deleteCustomPlan,
  clearPlans,
} from '../services/plansService';

interface PlansManagerProps {
  plans: ATTPlan[];
  onPlansChange: (plans: ATTPlan[]) => void;
  onNavigateToInbox?: () => void;
}

export const PlansManager: React.FC<PlansManagerProps> = ({ plans, onPlansChange, onNavigateToInbox }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  // New Plan form state
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleStartEdit = (plan: ATTPlan) => {
    setEditingId(plan.id);
    setEditPrice(Number(plan.monthlyPrice || 0));
  };

  const handleSaveEdit = (planId: string) => {
    if (editPrice > 0) {
      const updated = updatePlanPrice(planId, editPrice);
      onPlansChange(updated);
      setEditingId(null);
    }
  };

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(newPlanPrice);
    if (!newPlanName.trim() || isNaN(priceNum) || priceNum <= 0) return;

    const updated = addCustomPlan(newPlanName.trim(), priceNum, newPlanDesc.trim());
    onPlansChange(updated);
    setNewPlanName('');
    setNewPlanPrice('');
    setNewPlanDesc('');
    setIsAdding(false);
  };

  const handleDelete = (planId: string) => {
    const updated = deleteCustomPlan(planId);
    onPlansChange(updated);
    setDeleteConfirmId(null);
  };

  const handleClear = () => {
    clearPlans();
    onPlansChange([]);
    setClearConfirm(false);
  };

  return (
    <div className="space-y-6">
      {/* ⚠️ REQUIRED WARNING LEGEND IF NO TABLE IS LINKED */}
      {plans.length === 0 && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-amber-300">
                FALTA VINCULAR TABLA DE PLANES
              </h3>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                No hay precios de planes cargados en el sistema para evitar mostrar cifras no oficiales. Los planes ("Azul 1", "Azul 2", "Plata", "Oro", "Black", etc.) y sus precios de renta mensual se extraen automáticamente de la celda de abajo en la hoja <em>"Promociones AT&amp;T Premium"</em> del correo <strong>"LISTA DE PRECIOS"</strong>.
              </p>
              {onNavigateToInbox && (
                <div className="pt-2">
                  <button
                    onClick={onNavigateToInbox}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 px-3 py-1.5 rounded-lg font-semibold text-xs transition"
                  >
                    Ir a Bandeja Gmail / Subir Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Tag className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">Tabla de Planes AT&amp;T</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Los precios de los planes se extraen directamente de la celda ubicada abajo de cada plan en el Excel recibido. Aquí puedes editarlos o agregar planes adicionales que se mantendrán guardados permanentemente.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isAdding ? 'Cerrar Formulario' : 'Agregar Nuevo Plan'}</span>
          </button>

          {plans.length > 0 && (
            clearConfirm ? (
              <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-xl border border-rose-500/40">
                <span className="text-[11px] text-rose-300 px-2">¿Desvincular todos?</span>
                <button
                  onClick={handleClear}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition"
                >
                  Sí
                </button>
                <button
                  onClick={() => setClearConfirm(false)}
                  className="text-slate-400 hover:text-white px-2 py-1 text-xs"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setClearConfirm(true)}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-700 transition"
                title="Limpiar planes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Desvincular</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Form to add a new plan */}
      {isAdding && (
        <form
          onSubmit={handleAddPlan}
          className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 shadow-lg space-y-4 animate-fadeIn"
        >
          <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Registrar Nuevo Plan Comercial AT&amp;T</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Nombre del Plan *
              </label>
              <input
                type="text"
                placeholder="Ej. Titanio / Azul Plus"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Precio Mensual del Plan ($ MXN) *
              </label>
              <input
                type="number"
                step="1"
                placeholder="Ej. 1199"
                value={newPlanPrice}
                onChange={(e) => setNewPlanPrice(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Descripción / Beneficios
              </label>
              <input
                type="text"
                placeholder="Ej. Redes Sociales Ilimitadas"
                value={newPlanDesc}
                onChange={(e) => setNewPlanDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold shadow transition"
            >
              Guardar Plan en la App
            </button>
          </div>
        </form>
      )}

      {/* Plans Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
              <th className="py-3.5 px-5">Nombre del Plan</th>
              <th className="py-3.5 px-4 text-right">Precio Mensual ($ MXN)</th>
              <th className="py-3.5 px-4">Descripción / Beneficios</th>
              <th className="py-3.5 px-4 text-center">Tipo</th>
              <th className="py-3.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {plans.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">
                  <p className="font-semibold text-slate-400">Falta vincular tabla de planes</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Se cargarán automáticamente al procesar el correo "LISTA DE PRECIOS".
                  </p>
                </td>
              </tr>
            ) : (
              plans.map((plan) => {
                const isEditing = editingId === plan.id;
                return (
                  <tr key={plan.id} className="hover:bg-slate-800/40 transition">
                    {/* Plan Name */}
                    <td className="py-3.5 px-5 font-semibold text-white">
                      <div className="flex items-center space-x-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                        <span className="text-sm">{plan.name}</span>
                      </div>
                    </td>

                    {/* Monthly Price */}
                    <td className="py-3.5 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-slate-400">$</span>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-24 bg-slate-950 border border-cyan-500 rounded px-2 py-1 text-right text-white text-xs font-bold"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="font-bold text-cyan-300 text-sm">
                          ${Number(plan.monthlyPrice || 0).toLocaleString('es-MX')}
                          <span className="text-[10px] text-slate-400 font-normal"> /mes</span>
                        </span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 text-slate-300">
                      {plan.description || 'Plan extraído del archivo Excel'}
                    </td>

                    {/* Type badge */}
                    <td className="py-3.5 px-4 text-center">
                      {plan.isCustom ? (
                        <span className="bg-purple-950/80 text-purple-300 border border-purple-800/80 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          Personalizado
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          Del Excel
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {isEditing ? (
                        <button
                          onClick={() => handleSaveEdit(plan.id)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                          title="Guardar precio"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleStartEdit(plan)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
                            title="Editar precio del plan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {plan.isCustom && (
                            deleteConfirmId === plan.id ? (
                              <div className="flex items-center space-x-1 bg-slate-950 px-1.5 py-0.5 rounded border border-rose-500/50">
                                <span className="text-[10px] text-rose-300">¿Borrar?</span>
                                <button
                                  onClick={() => handleDelete(plan.id)}
                                  className="text-rose-400 hover:text-rose-300 font-bold px-1 text-[11px]"
                                >
                                  Sí
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-slate-400 hover:text-white px-1 text-[11px]"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(plan.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                                title="Eliminar plan personalizado"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>{plans.length} planes registrados</span>
          <span className="flex items-center space-x-1 text-cyan-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Persistencia activa: los precios se mantienen guardados</span>
          </span>
        </div>
      </div>
    </div>
  );
};
