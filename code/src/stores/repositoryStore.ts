import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RepositoryInfo } from '@/types/worktree'
import { gitService } from '@/services/git'

interface RepositoryState {
  // 状态
  repositories: RepositoryInfo[]
  activeRepoId: string | null
  isLoading: boolean
  error: string | null

  // 操作
  addRepository: (path: string) => Promise<RepositoryInfo | null>
  removeRepository: (id: string) => void
  setActiveRepository: (id: string) => void
  refreshRepositories: () => Promise<void>
  clearError: () => void
}

export const useRepositoryStore = create<RepositoryState>()(
  persist(
    (set, get) => ({
      // 初始状态
      repositories: [],
      activeRepoId: null,
      isLoading: false,
      error: null,

      // 添加仓库
      addRepository: async (path: string) => {
        set({ isLoading: true, error: null })
        
        try {
          // 检查是否是 Git 仓库
          const isRepo = await gitService.isGitRepo(path)
          if (!isRepo) {
            set({ 
              error: '选择的目录不是 Git 仓库', 
              isLoading: false 
            })
            return null
          }

          // 检查是否已存在
          const existing = get().repositories.find(r => r.path === path)
          if (existing) {
            set({ 
              activeRepoId: existing.id,
              isLoading: false 
            })
            return existing
          }

          // 获取仓库信息
          const repoInfo = await gitService.getRepositoryInfo(path)
          
          set(state => ({
            repositories: [...state.repositories, repoInfo],
            activeRepoId: repoInfo.id,
            isLoading: false
          }))
          
          return repoInfo
        } catch (error) {
          const message = error instanceof Error ? error.message : '添加仓库失败'
          set({ 
            error: message, 
            isLoading: false 
          })
          return null
        }
      },

      // 移除仓库
      removeRepository: (id: string) => {
        set(state => {
          const newRepos = state.repositories.filter(r => r.id !== id)
          const newActiveId = state.activeRepoId === id 
            ? (newRepos[0]?.id ?? null) 
            : state.activeRepoId
          
          return {
            repositories: newRepos,
            activeRepoId: newActiveId
          }
        })
      },

      // 设置当前仓库
      setActiveRepository: (id: string) => {
        set({ activeRepoId: id })
      },

      // 刷新仓库列表
      refreshRepositories: async () => {
        const { repositories } = get()
        if (repositories.length === 0) return
        
        set({ isLoading: true })
        
        try {
          const refreshedRepos = await Promise.all(
            repositories.map(async (repo) => {
              try {
                const info = await gitService.getRepositoryInfo(repo.path)
                return info
              } catch {
                return repo // 保持原信息
              }
            })
          )
          
          set({ 
            repositories: refreshedRepos,
            isLoading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : '刷新失败',
            isLoading: false 
          })
        }
      },

      clearError: () => {
        set({ error: null })
      }
    }),
    {
      name: 'worktree-manager-repositories',
    }
  )
)