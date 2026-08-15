import sys
import json

file_path = 'C:/Users/M-tech/.gemini/antigravity/scratch/jio-bp-portal/frontend/src/pages/BudgetPage.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

insertion = """      {/* Header Banner & Executive Stat Cards */}
      <ModuleHeader
        title="Contract Budget Status"
        subtitle={'Browse, manage and track every work order in your budget library.'}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} title="Sync JMS Work Orders" className="btn-ghost !px-2 !py-1 !text-xs">
              <RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleExport} title="Export" className="btn-ghost !px-2 !py-1 !text-xs"><Download size={13} /></button>
            {isAdmin && (
              <>
                <button onClick={() => setImportOpen(true)} title="Import" className="btn-ghost !px-2 !py-1 !text-xs"><Upload size={13} /></button>
                <button onClick={openAdd} title="Add Budget Work Order" className="btn-primary !px-2 !py-1 !text-xs"><Plus size={13} /></button>
              </>
            )}
          </div>
        }
        stats={[
          { icon: FileText, label: 'Work Orders', value: fyRecords.length, sub: activeFy === 'overall' ? 'All FY' : `FY ${activeFy}`, color: 'orange' },
          { icon: TrendingUp, label: 'FO Total Budget', value: formatINR(totalFoBudget), sub: 'Total Allocation', color: 'blue' },
          { icon: PieChartIcon, label: 'Budget Consumed', value: formatINR(totalConsumedBudget), sub: 'Total Spent', color: 'red' },
          { icon: CheckCircle2, label: 'Remaining Budget', value: formatINR(totalRemainingBudget), sub: 'Available Balance', color: totalRemainingBudget >= 0 ? 'green' : 'red' },
        ]}
      />

      {/* Filter & View Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <FyTabs basePath="/budget" />
          <SlotTabs slots={VALIDITY_SLOTS} activeSlot={activeSlot} onChange={setActiveSlot} />
        </div>

        {/* Search & Mode Toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search work orders..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field pl-9 py-2 text-xs"
            />
          </div>

          {viewMode === 'grid' && (
            <button 
              onClick={handleSelectAll} 
              className="btn-ghost !px-3 !py-1.5 !text-xs border border-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-800"
            >
              {selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          )}

          {/* Grid / List View Mode Toggle Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List size={14} /> List
            </button>
          </div>
        </div>
      </div>

      {/* ── Content View Rendering (Grid Cards vs List Table) ── */}
      {viewMode === 'grid' ? (
        <div className="space-y-6" ref={gridContainerRef}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 group">
            {sortedRecords.length === 0 ? (
              <div className="col-span-full text-center py-12 glass-card text-slate-400">
                No budget work orders found for the selected filter criteria.
              </div>
            ) : (
              paginatedRecords.map(b => {
                const total = b.fo_total_budget || 0
                const consumed = b.total_consumed || 0
                const bal = total - consumed
                return (
                  <div key={b.id} className="glass-card p-4 relative group/card hover:-translate-y-1 transition-all duration-300 flex flex-col h-full border border-slate-700/50 hover:border-jio-blue-500/50 shadow-lg hover:shadow-jio-blue-500/10" onClick={() => setSelectedRow(b)}>
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-md p-1 rounded-lg border border-slate-700 z-10">
"""

for i, line in enumerate(lines):
    if '<Pencil size={12}' in line:
        lines.insert(i, insertion)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Success")
        break
else:
    print("Could not find insertion point")
