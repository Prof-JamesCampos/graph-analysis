import { 
  App, 
  MarkdownView, 
  Menu, 
  Notice, 
  TFile, 
} from 'obsidian';
import type { 
  CacheItem 
} from 'obsidian';
import type AnalysisView from './AnalysisView';
import { DECIMALS, IMG_EXTENSIONS, LINKED, NOT_LINKED } from './Constants';
import type {
  GraphAnalysisSettings,
  CoCitation
} from './Interfaces';
//import type GraphAnalysisPlugin from './main';

// Definição do tipo para links resolvidos
export type ResolvedLinks = Record<string, Record<string, number>>;

/**
 * Lógica de Verificação de Links e Vault
 */
export function isInVault(app: App, path: string): boolean {
  return !!app.vault.getAbstractFileByPath(path);
}

export function isLinked(
  resolvedLinks: ResolvedLinks,
  from: string,
  to: string,
  directed = false
): boolean {
  if (!resolvedLinks || !resolvedLinks[from]) return false;
  
  const linked = !!resolvedLinks[from][to];
  if (directed || linked) return linked;

  return !!(resolvedLinks[to] && resolvedLinks[to][from]);
}

/**
 * Versão mais permissiva de verificação de link
 */
export function looserIsLinked(resolvedLinks: ResolvedLinks, source: string, target: string): boolean {
    if (!resolvedLinks) return false;
    return !!((resolvedLinks[source] && resolvedLinks[source][target]) || 
           (resolvedLinks[target] && resolvedLinks[target][source]));
}

export function classResolved(app: App, node: string): string {
  return node.endsWith('.md') && !isInVault(app, node) ? 'is-unresolved' : '';
}

export function classLinked(
  resolvedLinks: ResolvedLinks,
  from: string,
  to: string,
  directed = false
): string {
  return isLinked(resolvedLinks, from, to, directed) ? LINKED : NOT_LINKED;
}

/**
 * Utilitários de Matemática e Array
 */
export function sum(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0);
}

export function roundNumber(num: number, dec: number = DECIMALS): number {
  return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}

export function getCounts(arr: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) counts[item] = (counts[item] || 0) + 1;
  return counts;
}

export function getMaxKey(obj: Record<string, number>): string {
  return Object.keys(obj).reduce((a, b) => (obj[a] > obj[b] ? a : b));
}

export function uniqueArray<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function findSentence(sentences: string[], link: CacheItem): [number, number, number] {
  let aggrSentenceLength = 0;
  let count = 0;
  for (const sentence of sentences) {
    const nextLength = aggrSentenceLength + sentence.length;
    if (link.position.end.col <= nextLength) {
      return [count, aggrSentenceLength, nextLength];
    }
    aggrSentenceLength = nextLength;
    count += 1;
  }
  return [-1, 0, aggrSentenceLength];
}

/**
 * Debugging
 */
export function debug<T>(settings: GraphAnalysisSettings, log: T): void {
  if (settings.debugMode) console.log(log);
}

/**
 * Utilitários de String e Caminho
 */
export function dropPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export function presentPath(path: string): string {
  return path.endsWith('.md') ? path.substring(0, path.length - 3) : path;
}

export function dropExt(path: string): string {
  const parts = path.split('.');
  return parts.length === 1 ? path : parts.slice(0, -1).join('.');
}

export function getExt(path: string): string | undefined {
  return path.split('.').pop();
}

export function classExt(path: string): string {
  return `GA-ext-${getExt(path) || 'noext'}`;
}

export function isImg(path: string): boolean {
  const ext = getExt(path)?.toLowerCase();
  return ext ? IMG_EXTENSIONS.includes(ext) : false;
}

/**
 * UI e Navegação
 */
export function hoverPreview(event: MouseEvent, view: AnalysisView, to: string): void {
  const targetEl = event.target as HTMLElement;
  // @ts-ignore
  view.app.workspace.trigger('link-hover', view, targetEl, to, view.file?.path);
}

export async function copy(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  new Notice("Copied to clipboard");
}

export async function openOrSwitch(app: App, dest: string, event: MouseEvent): Promise<void> {
  const { workspace } = app;
  let destFile = app.metadataCache.getFirstLinkpathDest(dest, '');

  if (!destFile) {
      const fullPath = dest.endsWith(".md") ? dest : `${dest}.md`;
      destFile = (await app.vault.create(fullPath, "")) as TFile;
  }

  const leaf = (event.ctrlKey || event.getModifierState('Meta'))
    ? workspace.getLeaf('tab')
    : workspace.getMostRecentLeaf();

  if (leaf && destFile instanceof TFile) {
    await leaf.openFile(destFile);
  }
}

/**
 * Menus de Contexto (Resolvendo o erro de exportação)
 */
export function openMenu(event: MouseEvent, app: App, copyObj?: { toCopy: string }): void {
  const menu = new Menu();
  if (copyObj) {
    menu.addItem((item) =>
      item.setTitle('Copy path').setIcon('copy').onClick(() => copy(copyObj.toCopy))
    );
  } else {
    menu.addItem((item) =>
      item.setTitle('Create Link').setIcon('link').onClick(() => {
        const currFile = app.workspace.getActiveFile();
        const targetStr = (event.target as HTMLElement).innerText;
        if (currFile) {
           // Função auxiliar interna para simular o comportamento desejado
           console.log("Create link for:", targetStr);
        }
      })
    );
  }
  menu.showAtMouseEvent(event);
}

/**
 * Lógica de Contexto e Co-citações
 */
export async function getImgBufferPromise(app: App, path: string): Promise<ArrayBuffer | null> {
    const file = app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
        return await app.vault.readBinary(file);
    }
    return null;
}

export function addPreCocitation(
  preCocitations: { [name: string]: [number, CoCitation[]] },
  linkPath: string,
  measure: number,
  sentence: string[],
  source: string,
  line: number
): void {
  if (!preCocitations[linkPath]) preCocitations[linkPath] = [0, []];
  preCocitations[linkPath][0] = Math.max(preCocitations[linkPath][0], measure);
  preCocitations[linkPath][1].push({
    sentence,
    measure,
    source,
    line,
  });
}

/**
 * Navegação para Seleção
 */
export function jumpToSelection(app: App, line: number, sentence: string) {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (view && view.getMode() === 'source') {
    const { editor } = view;
    const lineStartPos = { ch: 0, line };
    const markStart = editor.posToOffset(lineStartPos);
    const markEnd = markStart + sentence.length;

    editor.setSelection(editor.offsetToPos(markStart), editor.offsetToPos(markEnd));
    editor.scrollIntoView({ from: editor.offsetToPos(markStart), to: editor.offsetToPos(markEnd) });
  }
}