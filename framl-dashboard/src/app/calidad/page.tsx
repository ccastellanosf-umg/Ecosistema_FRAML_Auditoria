import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { runQualityCheck, RULES_VERSION, type QualityRun } from "@/lib/quality/run";
import { formatDateTime } from "@/components/dashboard/format";
import { DimensionTile } from "@/components/quality/DimensionTile";
import { QualityTable } from "@/components/quality/QualityTable";
import { RuleFailures } from "@/components/quality/RuleFailures";

export const metadata: Metadata = {
  title: "Calidad de datos · Dashboard FRAML",
};

function Notice({ tone, children }: { tone: "info" | "warning" | "error"; children: React.ReactNode }) {
  const styles = {
    info: "border-border bg-surface text-secondary",
    warning:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
    error: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
  }[tone];
  return <div className={`rounded-xl border p-4 text-sm ${styles}`}>{children}</div>;
}

export default async function QualityPage({ searchParams }: PageProps<"/calidad">) {
  await connection();
  const demo = (await searchParams).demo === "1";
  const result = await runQualityCheck(demo);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Tablero de calidad de datos</h1>
          <p className="text-sm text-secondary">
            Evalúa cada transacción en tres dimensiones: completitud, validez y oportunidad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={demo ? "/calidad" : "/calidad?demo=1"}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-primary hover:bg-track"
          >
            {demo ? "Ver solo datos reales" : "Ver con errores de demostración"}
          </Link>
          {/* Plain anchor: the CSV is a file download, not a page navigation. */}
          <a
            href={demo ? "/calidad/evidencia?demo=1" : "/calidad/evidencia"}
            download
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-primary hover:bg-track"
          >
            Descargar evidencia (CSV)
          </a>
        </div>
      </header>

      {result.status === "not-configured" && (
        <Notice tone="warning">La conexión a la base de datos no está configurada. {result.detail}.</Notice>
      )}
      {result.status === "error" && (
        <Notice tone="error">No se pudieron cargar las transacciones: {result.detail}</Notice>
      )}
      {result.status === "ok" && <QualityDashboard run={result} demo={demo} />}
    </main>
  );
}

type QualityResult = Extract<QualityRun, { status: "ok" }>;

function QualityDashboard({ run, demo }: { run: QualityResult; demo: boolean }) {
  const { report, demoIds } = run;

  return (
    <>
      {demo && (
        <Notice tone="warning">
          <strong className="font-medium">Modo demostración.</strong> Se agregaron {demoIds.size} registros
          sintéticos con errores inyectados (marcados como <em>demo</em>) para visualizar las reglas. No se
          escribió nada en la base de datos.
        </Notice>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {report.dimensions.map((score) => (
          <DimensionTile key={score.dimension} score={score} />
        ))}
      </section>

      <RuleFailures failures={report.failuresByRule} />

      <QualityTable report={report} hasLoadDate={run.hasLoadDate} demoIds={demoIds} />

      <p className="text-xs text-muted">
        Ejecución: {formatDateTime(run.executedAt.toISOString())} · Reglas versión {RULES_VERSION} ·{" "}
        {report.rows.length} registros evaluados
      </p>

      {(!run.hasLoadDate || !run.customerCheck) && (
        <Notice tone="info">
          <p className="mb-1 font-medium text-primary">Reglas que todavía no se pueden verificar</p>
          <ul className="list-disc space-y-1 pl-5">
            {!run.hasLoadDate && (
              <li>
                <strong className="font-medium">Oportunidad:</strong> la tabla no tiene la columna{" "}
                <code>fecha_carga</code>, por lo que no se evalúa el plazo de carga.
              </li>
            )}
            {!run.customerCheck && (
              <li>
                <strong className="font-medium">Existencia del cliente:</strong> no hay acceso a la vista{" "}
                <code>clientes_ids</code>, por lo que no se valida que el cliente exista en{" "}
                <code>maestro_clientes</code>.
              </li>
            )}
          </ul>
        </Notice>
      )}
    </>
  );
}
