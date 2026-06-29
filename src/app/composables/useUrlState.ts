import { ref, watch, type Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export function useUrlState<T extends object>(defaults: T): Ref<T> {
  const route = useRoute()
  const router = useRouter()

  function decode(raw: string | undefined): T {
    if (!raw) return { ...defaults }
    try {
      const json = atob(raw)
      return { ...defaults, ...(JSON.parse(json) as Partial<T>) }
    } catch {
      return { ...defaults }
    }
  }

  function encode(val: T): string {
    return btoa(JSON.stringify(val))
  }

  const state = ref<T>(decode(route.query.s as string | undefined)) as Ref<T>

  watch(
    state,
    (val) => {
      router.replace({ query: { ...route.query, s: encode(val) } })
    },
    { deep: true }
  )

  return state
}
