const PRIORIDAD_COLOR = {
  alta: "bg-danger-tint text-danger border-danger/30",
  media: "bg-warn-tint text-warn border-warn/30",
  baja: "bg-success-tint text-success border-success/30",
};

const PRIORIDAD_BAR = {
  alta: "bg-danger",
  media: "bg-warn",
  baja: "bg-success",
};

const ESTADO_COLOR = {
  abierto: "bg-danger-tint text-danger border-danger/30",
  en_proceso: "bg-warn-tint text-warn border-warn/30",
  cerrado: "bg-success-tint text-success border-success/30",
};

const ESTADO_LABEL = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  cerrado: "Cerrado",
};

const PRIORIDAD_LABEL = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export function PriorityBar({ prioridad }) {
  return (
    <div
      className={`priority-gauge ${PRIORIDAD_BAR[prioridad] || "bg-muted"}`}
      title={`Prioridad ${PRIORIDAD_LABEL[prioridad] || prioridad}`}
    />
  );
}

export function EstadoBadge({ estado }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium font-mono uppercase tracking-wide ${
        ESTADO_COLOR[estado] || "bg-surface-alt text-muted border-border"
      }`}
    >
      {ESTADO_LABEL[estado] || estado}
    </span>
  );
}

export function PrioridadBadge({ prioridad }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium font-mono uppercase tracking-wide ${
        PRIORIDAD_COLOR[prioridad] || "bg-surface-alt text-muted border-border"
      }`}
    >
      {PRIORIDAD_LABEL[prioridad] || prioridad}
    </span>
  );
}

export function RolBadge({ rol }) {
  const labels = {
    operador: "Operador",
    admin_departamento: "Admin. Departamento",
    admin_global: "Admin. Global",
  };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/10 text-white border border-white/20 text-xs font-medium font-mono uppercase tracking-wide">
      {labels[rol] || rol}
    </span>
  );
}
