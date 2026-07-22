declare global {
  interface Window {
    YT?: typeof YT
    onYouTubeIframeAPIReady?: () => void
  }
  // eslint-disable-next-line no-var -- globalThisの型に生やすにはvar宣言が必要
  var onYouTubeIframeAPIReady: (() => void) | undefined
}

let apiPromise: Promise<typeof YT> | undefined

export const loadYouTubeIframeApi = (): Promise<typeof YT> => {
  if (apiPromise) {
    return apiPromise
  }

  apiPromise = new Promise((resolve) => {
    if (globalThis.YT && globalThis.YT.Player) {
      resolve(globalThis.YT)
      return
    }

    const previousCallback = globalThis.onYouTubeIframeAPIReady
    globalThis.onYouTubeIframeAPIReady = (): void => {
      if (previousCallback) {
        previousCallback()
      }
      resolve(globalThis.YT as typeof YT)
    }

    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    document.head.append(script)
  })

  return apiPromise
}
