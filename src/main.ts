import { addIcon, Notice, Plugin, WorkspaceLeaf } from 'obsidian'
// Removida a dependência externa que causava incompatibilidade
import AnalysisView from './AnalysisView'
import {
  ANALYSIS_TYPES,
  DEFAULT_SETTINGS,
  iconSVG,
  VIEW_TYPE_GRAPH_ANALYSIS,
} from './Constants'
import type { GraphAnalysisSettings } from './Interfaces'
import MyGraph from './MyGraph'
import { SampleSettingTab } from './Settings'
import { debug } from './Utility'

export default class GraphAnalysisPlugin extends Plugin {
  settings: GraphAnalysisSettings
  g: MyGraph

  async onload() {
    console.log('loading graph analysis plugin');

    await this.loadSettings();
    addIcon('GA-ICON', iconSVG);

    // Registro da View - Padrão moderno
    this.registerView(
      VIEW_TYPE_GRAPH_ANALYSIS,
      (leaf: WorkspaceLeaf) => new AnalysisView(leaf, this, null)
    );

    this.addCommand({
      id: 'show-graph-analysis-view',
      name: 'Open Graph Analysis View',
      callback: () => {
        this.activateView();
      },
    });

    this.addCommand({
      id: 'refresh-analysis-view',
      name: 'Refresh Graph Analysis View',
      callback: async () => {
        await this.refreshGraph();
        const currView = await this.getActiveView();
        if (currView) {
            await currView.draw(currView.currSubtype);
        }
      },
    });

    // Comandos dinâmicos para cada tipo de análise
    ANALYSIS_TYPES.forEach((sub) => {
      this.addCommand({
        id: `open-${sub.subtype}`,
        name: `Open ${sub.subtype}`,
        callback: async () => {
          const currView = await this.getActiveView();
          if (currView) {
              await currView.draw(sub.subtype);
          }
        },
      });
    });

    this.addSettingTab(new SampleSettingTab(this.app, this));

    // Espera o layout carregar para inicializar o grafo
    this.app.workspace.onLayoutReady(async () => {
      // Pequeno delay nativo em vez de usar biblioteca externa
      await new Promise(f => setTimeout(f, 500)); 
      
      await this.refreshGraph();
      this.activateView();
    });
  }

  // Substitui o openView da biblioteca antiga pelo método nativo do Obsidian
  async activateView() {
    const { workspace } = this.app;
    
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_GRAPH_ANALYSIS);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: VIEW_TYPE_GRAPH_ANALYSIS,
        active: true,
      });
    }

    if (leaf) {
        workspace.revealLeaf(leaf);
    }
  }

  async getActiveView(): Promise<AnalysisView | null> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_GRAPH_ANALYSIS);
    if (leaves.length > 0) {
      return leaves[0].view as AnalysisView;
    }
    return null;
  }

  async refreshGraph() {
    try {
      console.time('Initialise Graph');
      this.g = new MyGraph(this.app, this.settings);
      await this.g.initGraph();
      debug(this.settings, { g: this.g });
      console.timeEnd('Initialise Graph');
      new Notice('Index Refreshed');
    } catch (error) {
      console.error(error);
      new Notice('An error occurred with Graph Analysis. Check console.');
    }
  }

  onunload() {
    console.log('unloading graph analysis plugin');
    // Não é mais necessário o detach manual agressivo, o Obsidian limpa ao descarregar
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}