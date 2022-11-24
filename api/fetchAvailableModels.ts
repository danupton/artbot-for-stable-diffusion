import { setAvailableModels } from '../store/modelStore'
import { isAppActive } from '../utils/appUtils'

let isPending = false
const fetchAvailableModels = async () => {
  if (isPending) {
    return
  }

  if (!isAppActive()) {
    return
  }

  isPending = true

  let availableModels = [
    {
      name: 'stable_diffusion',
      count: 1,
      eta: 0,
      performance: 0,
      queued: 0
    }
  ]

  try {
    const res = await fetch(`/artbot/api/models-available`)
    const { models: modelDetails } = await res.json()

    if (Array.isArray(modelDetails) && modelDetails.length > 0) {
      modelDetails.sort((a, b) => {
        if (a.count < b.count) {
          return 1
        }
        if (a.count > b.count) {
          return -1
        }
        return 0
      })

      availableModels = modelDetails.filter((model) => {
        // Stable Diffusion Inpainting shouldn't appear in our model dropdown
        if (model.name === 'stable_diffusion_inpainting') {
          return false
        }

        return true
      })
    }
  } catch (err) {
    console.log(`Warning: Unable to fetch available models. API offline?`)
  } finally {
    isPending = false
    setAvailableModels(availableModels)
  }
}

export default fetchAvailableModels