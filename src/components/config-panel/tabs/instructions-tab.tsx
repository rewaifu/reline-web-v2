import {
  computed,
  effect,
  Show,
  signal,
  store,
  untrack,
  useContext,
} from "reze-js";
import { NodesContext } from "~/context/contexts";
import type { Component } from "~/types/component";
import { NodeType } from "~/types/enums";
import { nodeLabel, nodeRegistry } from "~/lib/nodes";
import { NodeSwap } from "~/components/node-swap/node-swap";
import { locale, t, type Locale } from "~/lib/i18n";
import { BetaChart } from "~/components/noise-chart/beta-chart";
import type { StackNode } from "~/types/node";
import type { NoiseNodeOptions } from "~/types/options/noise";
import styles from "../config-panel.module.scss";

/** Per-node instructions, authored as Markdown in src/instructions/<locale>/
 * and compiled to HTML at build time (`?html`, see vite.config.ts): the
 * parser stays out of the main bundle, and each guide is its own chunk,
 * fetched the first time it is shown. Keyed "locale/type", so the rendered
 * document follows the switcher. */
export const INSTRUCTION_LOADERS: Record<string, () => Promise<string>> =
  Object.fromEntries(
    Object.entries(
      import.meta.glob("../../../instructions/*/*.md", {
        query: "?html",
        import: "default",
      }),
    ).map(([path, load]) => [
      path
        .match(/instructions\/([^/]+)\/([^/]+)\.md$/)!
        .slice(1)
        .join("/"),
      load as () => Promise<string>,
    ]),
  );

/** Guides fetched so far, by key. */
const guides = store<Record<string, string>>({});
const requested = new Set<string>();
const requestGuide = (key: string): void => {
  const load = INSTRUCTION_LOADERS[key];
  if (load === undefined || requested.has(key)) return;
  requested.add(key);
  void load().then((html) => {
    guides[key] = html;
  });
};

/** The Markdown parser, fetched the first time a plugin's own guide needs it. */
let markdown = signal<((source: string) => string) | undefined>(undefined);
const loadMarkdown = (): void => {
  void import("marked").then(({ marked }) => {
    markdown = (source) => marked.parse(source, { async: false });
  });
};

/** Live Beta(a, b) density for the selected noise node, rendered above its
 * guide: the chart follows the form's a/b, so the doc always pictures the
 * actual noise. Other nodes render nothing. */
const NoiseBetaChart: Component<{ node: () => StackNode | undefined }> = (
  props,
) => (
  <Show when={props.node()?.type === NodeType.NOISE}>
    <BetaChart options={props.node()!.options as NoiseNodeOptions} />
  </Show>
);

/** The guide of a node type in one language; a definition's own guide (a
 * plugin's, Markdown) wins over the bundled file (compiled HTML). Empty until
 * the guide (or, for a plugin's, the parser) is loaded. */
const renderGuide = (
  def: ReturnType<typeof nodeRegistry.get>,
  lang: Locale,
  parse: ((source: string) => string) | undefined,
): string => {
  if (!def) return "";
  const own = def.doc?.[lang];
  if (own === undefined) return guides[`${lang}/${def.type}`] ?? "";
  return parse === undefined ? "" : parse(own);
};

export interface InstructionsTabProps {
  selectedUid: () => string | null;
}

export const InstructionsTab: Component<InstructionsTabProps> = (props) => {
  const nodes = useContext(NodesContext);
  const node = computed(nodes.find((n) => n.uid === props.selectedUid()));
  const def = computed(node ? nodeRegistry.get(node.type) : undefined);
  const docHtml = computed(renderGuide(def, locale(), markdown));
  effect(() => {
    if (def === undefined) return;
    const lang = locale();
    if (def.doc?.[lang] === undefined)
      untrack(() => requestGuide(`${lang}/${def.type}`));
    else if (markdown === undefined) untrack(loadMarkdown);
  });

  return (
    <div class={styles.instructions}>
      <Show when={node}>
        {(n) => (
          <div class={styles.instructionsHeader}>
            <span class={styles.instructionsTitle}>
              {n.name ?? nodeLabel(n.type)}
            </span>
            <NodeSwap node={n} />
          </div>
        )}
      </Show>
      <Show
        when={def}
        fallback={<p class={styles.empty}>{t("panel.instructions.empty")}</p>}
      >
        <NoiseBetaChart node={() => node} />
        {/* Instructions are trusted local files authored by the user, so
         * rendering the compiled HTML directly is safe here. */}
        <div class={styles.doc} innerHTML={docHtml} />
      </Show>
    </div>
  );
};
