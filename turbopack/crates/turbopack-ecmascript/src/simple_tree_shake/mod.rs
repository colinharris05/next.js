//! Intermediate tree shaking that uses global information but not good as the full tree shaking.

use anyhow::{Context, Result};
use rustc_hash::{FxHashMap, FxHashSet};
use turbo_rcstr::RcStr;
use turbo_tasks::{ResolvedVc, Vc};
use turbopack_core::{module_graph::ModuleGraph, resolve::ExportUsage};

use crate::chunk::EcmascriptChunkPlaceable;

#[turbo_tasks::function]
pub async fn get_module_export_usages(
    graph: ResolvedVc<ModuleGraph>,
    module: ResolvedVc<Box<dyn EcmascriptChunkPlaceable>>,
) -> Result<Vc<ModuleExportUsageInfo>> {
    let export_usage_info = compute_export_usage_info(graph)
        .resolve_strongly_consistent()
        .await?;

    let export_usage_info = export_usage_info.await?;

    let Some(exports) = export_usage_info.used_exports.get(&module) else {
        // Pages like [project]/packages/next/dist/esm/build/templates/pages.js does not have any
        // usage information.
        return Ok(ModuleExportUsageInfo::all());
    };

    Ok(ModuleExportUsageInfo {
        exports: exports.clone(),
    }
    .cell())
}

#[turbo_tasks::function(operation)]
async fn compute_export_usage_info(graph: ResolvedVc<ModuleGraph>) -> Result<Vc<ExportUsageInfo>> {
    let mut usage = ExportUsageInfo::default();

    graph
        .await?
        .traverse_all_edges_unordered(|(_, edge), target| {
            if let Some(target_module) =
                ResolvedVc::try_downcast::<Box<dyn EcmascriptChunkPlaceable>>(target.module)
            {
                usage
                    .used_exports
                    .entry(ResolvedVc::upcast(target_module))
                    .or_default()
                    .insert(edge.export.clone());
            }

            Ok(())
        })
        .await
        .context("failed to traverse module graph")?;

    Ok(usage.cell())
}

#[turbo_tasks::value]
#[derive(Default)]
pub struct ExportUsageInfo {
    used_exports: FxHashMap<ResolvedVc<Box<dyn EcmascriptChunkPlaceable>>, FxHashSet<ExportUsage>>,
}

#[turbo_tasks::value]
pub struct ModuleExportUsageInfo {
    exports: FxHashSet<ExportUsage>,
}

impl ModuleExportUsageInfo {
    pub fn is_export_used(&self, export_name: RcStr) -> bool {
        self.exports.contains(&ExportUsage::All)
            || self.exports.contains(&ExportUsage::Named(export_name))
    }
}

#[turbo_tasks::value_impl]
impl ModuleExportUsageInfo {
    /// This preserves all exports. This is used when the module is not found in the export usage
    /// info.
    #[turbo_tasks::function]
    fn all() -> Vc<Self> {
        let mut exports = FxHashSet::default();
        exports.insert(ExportUsage::All);
        Self::cell(ModuleExportUsageInfo { exports })
    }
}
