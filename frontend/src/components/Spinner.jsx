// Indicador de carga consistente para toda la app.
export default function Spinner({ label = "Cargando…", full = false }) {
  return (
    <div
      className={
        full
          ? "min-h-screen flex items-center justify-center bg-surface-alt"
          : "flex items-center justify-center py-16"
      }
    >
      <div className="flex items-center gap-2.5 text-muted">
        <span className="w-4 h-4 rounded-full border-2 border-border border-t-ph-yellow animate-spin" />
        <span className="text-sm font-mono">{label}</span>
      </div>
    </div>
  );
}
