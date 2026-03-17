import { useState, useEffect } from 'react'
import { X, AlertTriangle, Clock, Trash2, RefreshCw, Info } from 'lucide-react'
import { gitService } from '@/services/git'
import type { WorktreeHint } from '@/types/worktree'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { clsx } from 'clsx'

interface HintsPanelProps {
  isOpen: boolean
  onClose: () => void
  repoPath: string
  mainBranch: string
}

export function HintsPanel({ isOpen, onClose, repoPath, mainBranch }: HintsPanelProps) {
  const { deleteWorktree, refreshWorktrees } = useWorktreeStore()
  const [mergedHints, setMergedHints] = useState<WorktreeHint[]>([])
  const [staleHints, setStaleHints] = useState<WorktreeHint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [staleDays, setStaleDays] = useState(30)

  useEffect(() => {
    if (isOpen) {
      fetchHints()
    }
  }, [isOpen, repoPath, mainBranch, staleDays])

  const fetchHints = async () => {
    setIsLoading(true)
    try {
      const [merged, stale] = await Promise.all([
        gitService.getMergedHints(repoPath, mainBranch),
        gitService.getStaleHints(repoPath, staleDays),
      ])
      setMergedHints(merged)
      setStaleHints(stale)
    } catch (err) {
      console.error('Failed to fetch hints:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteMerged = async (branch: string, worktreeId: string) => {
    if (!confirm(`确定删除已合并分支 "${branch}" 的 worktree 吗？`)) return
    await deleteWorktree(worktreeId, false)
    await fetchHints()
  }

  const handleCleanupMerged = async () => {
    if (!confirm(`确定清理所有已合并的 worktree 吗？共 ${mergedHints.length} 个`)) return
    
    const paths = mergedHints.map(h => h.worktreeId)
    try {
      const result = await gitService.batchDeleteWorktrees(repoPath, paths, false)
      alert(`清理完成: 成功 ${result.successCount} 个, 失败 ${result.failedCount} 个`)
      await fetchHints()
      await refreshWorktrees()
    } catch (err) {
      console.error('Batch delete failed:', err)
    }
  }

  if (!isOpen) return null

  const totalHints = mergedHints.length + staleHints.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            智能提示
            {totalHints > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">
                {totalHints}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHints}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : totalHints === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">暂无提示</p>
              <p className="text-sm mt-1">所有 worktree 状态良好</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 已合并提示 */}
              {mergedHints.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-green-500" />
                      已合并分支 ({mergedHints.length})
                    </h3>
                    <button
                      onClick={handleCleanupMerged}
                      className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      一键清理
                    </button>
                  </div>
                  <div className="space-y-2">
                    {mergedHints.map((hint) => (
                      <div
                        key={hint.worktreeId}
                        className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{hint.branch}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{hint.message}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteMerged(hint.branch, hint.worktreeId)}
                          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 陈旧提示 */}
              {staleHints.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      长期未更新 ({staleHints.length})
                    </h3>
                    <select
                      value={staleDays}
                      onChange={(e) => setStaleDays(Number(e.target.value))}
                      className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                    >
                      <option value={7}>7 天未更新</option>
                      <option value={14}>14 天未更新</option>
                      <option value={30}>30 天未更新</option>
                      <option value={60}>60 天未更新</option>
                      <option value={90}>90 天未更新</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    {staleHints.map((hint) => (
                      <div
                        key={hint.worktreeId}
                        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{hint.branch}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{hint.message}</p>
                        </div>
                        <span className="px-2 py-1 text-xs bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded">
                          {hint.inactiveDays} 天
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}