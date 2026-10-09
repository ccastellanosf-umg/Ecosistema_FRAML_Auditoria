import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { fetchQualityData } from "@/lib/supabase/server";
import { buildDemoRows } from "@/lib/quality/demo";
import { evaluateQuality } from "@/lib/quality/rules";
import { DimensionTile } from "@/components/quality/DimensionTile";
import { QualityTable } from "@/components/quality/QualityTable";
import { RuleFailures } from "@/components/quality/RuleFailures";

export const metadata: Metadata = {
  title: "Calidad de datos · Dashboard FRAML",
};

const MAX_LOAD_DELAY_HOURS = 24;

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
  const result = await fetchQualityData();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Tablero de calidad de datos</h1>
          <p className="text-sm text-secondary">
            Evalúa cada transacción en tres dimensiones: completitud, validez y oportunidad.
          </p>
        </div>
        <Link
          href={demo ? "/calidad" : "/calidad?demo=1"}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-primary hover:bg-track"
        >
          {demo ? "Ver solo datos reales" : "Ver con errores de demostración"}
        </Link>
      </header>

      {result.status === "not-configured" && (
        <Notice tone="warning">La conexión a la base de datos no está configurada. {result.detail}.</Notice>
      )}
      {result.status === "error" && (
        <Notice tone="error">No se pudieron cargar las transacciones: {result.detail}</Notice>
      )}
      {result.status === "ok" && <QualityDashboard data={result} demo={demo} />}
    </main>
  );
}

type QualityData = Extract<Awaited<ReturnType<typeof fetchQualityData>>, { status: "ok" }>;

function QualityDashboard({ data, demo }: { data: QualityData; demo: boolean }) {
  const now = new Date();
  const demoRows = demo ? buildDemoRows(now) : [];
  const report = evaluateQuality([...data.rows, ...demoRows], {
    now,
    knownCustomerIds: data.knownCustomerIds,
    maxLoadDelayHours: MAX_LOAD_DELAY_HOURS,
  });
  const demoIds = new Set(demoRows.map((row) => Number(row.id_transaccion)));

  return (
    <>
      {demo && (
        <Notice tone="warning">
          <strong className="font-medium">Modo demostración.</strong> Se agregaron {demoRows.length} registros
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

      <QualityTable report={report} hasLoadDate={data.hasLoadDate} demoIds={demoIds} />

      {(!data.hasLoadDate || !data.knownCustomerIds) && (
        <Notice tone="info">
          <p className="mb-1 font-medium text-primary">Reglas que todavía no se pueden verificar</p>
          <ul className="list-disc space-y-1 pl-5">
            {!data.hasLoadDate && (
              <li>
                <strong className="font-medium">Oportunidad de carga:</strong> la tabla no tiene la columna{" "}
                <code>fecha_carga</code>. Solo se detectan fechas en el futuro.
              </li>
            )}
            {!data.knownCustomerIds && (
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
