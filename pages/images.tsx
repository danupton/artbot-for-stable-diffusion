/* eslint-disable @next/next/no-img-element */
import Head from 'next/head'
import React, { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import LazyLoad from 'react-lazyload'
import styled from 'styled-components'

import PageTitle from '../components/UI/PageTitle'
import Spinner from '../components/Spinner'
import {
  bulkDeleteImages,
  countCompletedJobs,
  countFilterCompleted,
  fetchCompletedJobs,
  filterCompletedJobs,
  imageCount
} from '../utils/db'
import ImageSquare from '../components/ImageSquare'
import { trackEvent } from '../api/telemetry'
import { Button } from '../components/UI/Button'
import { useWindowSize } from '../hooks/useWindowSize'
import ImageCard from '../components/ImagesPage/ImageCard/imageCard'
import DotsVerticalIcon from '../components/icons/DotsVerticalIcon'
import CircleCheckIcon from '../components/icons/CircleCheckIcon'
import TextButton from '../components/UI/TextButton'
import ConfirmationModal from '../components/ConfirmationModal'
import MenuButton from '../components/UI/MenuButton'
import FilterIcon from '../components/icons/FilterIcon'
import HeartIcon from '../components/icons/HeartIcon'
import useComponentState from '../hooks/useComponentState'
import { downloadImages } from '../utils/imageUtils'
import { useSwipeable } from 'react-swipeable'
import { useEffectOnce } from '../hooks/useEffectOnce'
import MasonryLayout from '../components/MasonryLayout'
import Modal from '../components/Modal'
import SpinnerV2 from '../components/Spinner'
import DropDownMenu from '../components/UI/DropDownMenu'
import DropDownMenuItem from '../components/UI/DropDownMenuItem'

const MenuSeparator = styled.div`
  width: 100%;
  border-bottom: 1px solid ${(props) => props.theme.navLinkActive};
`

const NonLink = styled.div`
  cursor: pointer;
  position: relative;
`

const ImageOverlay = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  background-color: gray;
  opacity: 0.6;
`

const SelectCheck = styled(CircleCheckIcon)`
  position: absolute;
  bottom: 4px;
  right: 4px;
`

const StyledHeartIcon = styled(HeartIcon)`
  position: absolute;
  top: 4px;
  right: 4px;
`

const ButtonContainer = styled.div`
  column-gap: 8px;
  display: flex;
  flex-direction: row;
  row-gap: 4px;
  max-width: 240px;
  flex-wrap: wrap;
  justify-content: end;

  @media (min-width: 640px) {
    max-width: 100%;
  }
`

const ImagesPage = () => {
  const handlers = useSwipeable({
    onSwipedLeft: () => handleLoadMore('next'),
    onSwipedRight: () => handleLoadMore('prev'),
    preventScrollOnSwipe: true
  })
  const router = useRouter()
  const size = useWindowSize()

  const [componentState, setComponentState] = useComponentState({
    deleteMode: false,
    deleteSelection: [],
    showDeleteModal: false,
    showDownloadModal: false,

    offset: Number(router.query.offset) || 0,
    filterMode: router.query.filter || 'all',
    layoutMode: 'layout',
    sortMode: router.query.sort || 'new',
    showFilterMenu: false,
    showLayoutMenu: false,
    totalImages: 0,
    images: [],
    isLoading: true
  })

  const getImageCount = useCallback(async () => {
    let count

    if (componentState.filterMode !== 'all') {
      count = await countFilterCompleted({
        filterType: componentState.filterMode,
        model: router.query.model as string
      })
    } else {
      count = await imageCount()
    }
    setComponentState({ totalImages: count })
  }, [componentState.filterMode, router.query.model, setComponentState])

  const fetchImages = useCallback(async () => {
    const offset = Number(router.query.offset) || 0
    let data
    const sort = localStorage.getItem('imagePageSort') || 'new'

    if (componentState.filterMode === 'all') {
      data = await fetchCompletedJobs({ offset, sort })
    } else {
      data = await filterCompletedJobs({
        offset,
        sort,
        filterType: componentState.filterMode,
        model: router.query.model as string
      })
    }
    await getImageCount()
    setComponentState({ images: data, isLoading: false })
  }, [
    componentState.filterMode,
    getImageCount,
    router.query.model,
    router.query.offset,
    setComponentState
  ])

  const handleDeleteImageClick = async () => {
    trackEvent({
      event: 'BULK_DELETE_CLICK',
      context: 'ImagesPage',
      data: {
        totalImages: componentState.totalImages,
        numImagesDeleted: componentState.deleteSelection.length
      }
    })

    await bulkDeleteImages(componentState.deleteSelection)
    await getImageCount()
    await fetchImages()
    setComponentState({
      deleteMode: false,
      deleteSelection: [],
      showDeleteModal: false
    })
  }

  const handleLoadMore = useCallback(
    async (btn: string) => {
      setComponentState({
        isLoading: true
      })
      window.scrollTo(0, 0)
      let newNum
      if (btn === 'last') {
        const count = await countCompletedJobs()
        const sort = localStorage.getItem('imagePageSort') || 'new'
        const data = await fetchCompletedJobs({ offset: count - 100, sort })
        setComponentState({
          images: data,
          isLoading: false,
          offset: count - 100
        })

        const newQuery = Object.assign({}, router.query)
        newQuery.offset = String(count - 100)
        //@ts-ignore
        router.push(`?${new URLSearchParams(newQuery).toString()}`)
        return
      }

      if (btn === 'first') {
        const sort = localStorage.getItem('imagePageSort') || 'new'
        const data = await fetchCompletedJobs({
          offset: 0,
          sort
        })
        setComponentState({
          images: data,
          isLoading: false,
          offset: 0
        })

        const newQuery = Object.assign({}, router.query)
        delete newQuery.offset
        //@ts-ignore
        router.push(`?${new URLSearchParams(newQuery).toString()}`)
        return
      }

      if (btn === 'prev') {
        newNum =
          componentState.offset - 100 < 0 ? 0 : componentState.offset - 100
      } else {
        newNum =
          componentState.offset + 100 > componentState.totalImages
            ? componentState.offset
            : componentState.offset + 100
      }

      trackEvent({
        event: 'LOAD_MORE_IMAGES_CLICK',
        context: '/pages/images',
        data: {
          range: `${btn} - ${newNum}`
        }
      })

      //await fetchImages(newNum)
      setComponentState({ offset: newNum })

      const newQuery = Object.assign({}, router.query)
      newQuery.offset = newNum
      //@ts-ignore
      router.push(`?${new URLSearchParams(newQuery).toString()}`)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [componentState.offset, componentState.totalImages, setComponentState]
  )

  useEffect(() => {
    fetchImages()
    getImageCount()

    if (localStorage.getItem('showLayout')) {
      setComponentState({
        layoutMode: localStorage.getItem('showLayout') || 'layout'
      })
    }
  }, [fetchImages, getImageCount, router.query, setComponentState])

  let defaultStyle = `flex gap-y-3 mt-4 relative`

  if (
    componentState.layoutMode === 'grid' ||
    componentState.layoutMode === 'layout'
  ) {
    defaultStyle += ` flex-wrap gap-x-3 justify-center md:justify-start`
  } else {
    defaultStyle += ` flex-col justify-center`
  }

  const currentOffset = componentState.offset + 1
  const maxOffset =
    componentState.offset + 100 > componentState.totalImages
      ? componentState.totalImages
      : componentState.offset + 100

  let imageColumns = 2
  // @ts-ignore
  if (size?.width > 1280) {
    imageColumns = 4
    // @ts-ignore
  } else if (size?.width > 800) {
    imageColumns = 3
  }

  const handleImageClick = useCallback(
    (id: string) => {
      let newArray: Array<string> = [...componentState.deleteSelection]
      if (componentState.deleteMode) {
        const index = newArray.indexOf(id)
        if (index >= 0) {
          newArray.splice(index, 1)
        } else {
          newArray.push(id)
        }
      }

      setComponentState({ deleteSelection: newArray })
    },
    [
      componentState.deleteMode,
      componentState.deleteSelection,
      setComponentState
    ]
  )

  const handleDownloadClick = async () => {
    if (componentState.deleteSelection.length === 0) {
      return
    }

    setComponentState({ showDownloadModal: true })

    const imagesToDownload: Array<any> = []

    componentState.deleteSelection.forEach((id: number) => {
      componentState.images.filter(async (image: any) => {
        if (image.id === id) {
          imagesToDownload.push(image)
        }
      })
    })

    await downloadImages(imagesToDownload)

    setComponentState({ showDownloadModal: false })
    trackEvent({
      event: 'BULK_FILE_DOWNLOAD',
      context: '/pages/images',
      data: {
        numImages: componentState.deleteSelection.length
      }
    })

    setComponentState({
      deleteMode: false,
      deleteSelection: [],
      showDeleteModal: false
    })
  }

  const handleSelectAll = () => {
    let delArray: Array<string> = []
    componentState.images.forEach((image: { id: string }) => {
      delArray.push(image.id)
    })

    setComponentState({ deleteSelection: delArray })
  }

  const handleFilterButtonClick = useCallback(() => {
    if (componentState.showFilterMenu) {
      setComponentState({ showFilterMenu: false })
    } else {
      setComponentState({
        showFilterMenu: true,
        showLayoutMenu: false
      })
    }
  }, [componentState.showFilterMenu, setComponentState])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (componentState.deleteMode && e.keyCode === 27) {
        setComponentState({
          deleteMode: false,
          deleteSelection: [],
          showDeleteModal: false
        })
      }

      if (componentState.deleteMode && e.keyCode === 13) {
        setComponentState({ showDeleteModal: true })
      } else if (e.keyCode === 37) {
        //left
        handleLoadMore('prev')
      } else if (e.keyCode === 39) {
        // right
        handleLoadMore('next')
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [componentState.deleteMode, handleLoadMore, setComponentState])

  useEffectOnce(() => {
    trackEvent({
      event: 'PAGE_VIEW',
      context: '/pages/images'
    })
  })

  useEffect(() => {
    if (localStorage.getItem('imagePageSort') === 'old') {
      setComponentState({ sortMode: 'old' })
    } else {
      setComponentState({ sortMode: 'new' })
    }
  }, [setComponentState])

  useEffect(() => {
    const updateObject = {
      isLoading: true
    }

    // @ts-ignore
    if (router.query.model) updateObject.filterMode = 'model'
    // @ts-ignore
    if (router.query.filter) updateObject.filterMode = router.query.filter
    // @ts-ignore
    if (router.query.offset) updateObject.offset = Number(router.query.offset)
    //@ts-ignore
    if (!router.query.offset) updateObject.offset = 0
    // @ts-ignore
    if (router.query.sort) updateObject.sortMode = router.query.sort

    setComponentState(updateObject)
  }, [router.query, setComponentState])

  const LinkEl = componentState.deleteMode ? NonLink : Link

  const countDescriptor = () => {
    let string = ``

    if (componentState.filterMode === 'model') {
      string = `"${router?.query?.model || ''}" `
    }

    if (componentState.filterMode === 'favorited') {
      string = 'favorite '
    }

    if (componentState.filterMode === 'unfavorited') {
      string = 'unfavorited '
    }

    if (componentState.filterMode === 'text2img') {
      string = 'text2img '
    }

    if (componentState.filterMode === 'img2img') {
      string = 'img2img '
    }

    if (componentState.filterMode === 'inpainting') {
      string = 'inpainted '
    }

    return string
  }

  return (
    <div {...handlers}>
      {componentState.showDownloadModal && (
        <Modal hideCloseButton>
          Downloading images
          <div className="w-full flex flex-row text-sm mt-4 mb-4">
            Processing selected images for download and converting to PNGs.
            Please wait.
          </div>
          <div className="w-full flex flex-row justify-center">
            <SpinnerV2 />
          </div>
        </Modal>
      )}
      {componentState.showDeleteModal && (
        <ConfirmationModal
          multiImage={componentState.deleteSelection.length > 1}
          onConfirmClick={() => handleDeleteImageClick()}
          closeModal={() => {
            setComponentState({
              deleteMode: false,
              deleteSelection: [],
              showDeleteModal: false
            })
          }}
        />
      )}
      <Head>
        <title>ArtBot - Your images</title>
      </Head>
      <div className="flex flex-row w-full items-center">
        <div className="inline-block w-1/2">
          <PageTitle>Your images</PageTitle>
        </div>
        <div className="flex flex-row justify-end w-1/2 items-start h-[38px] relative gap-2">
          <MenuButton
            active={componentState.deleteMode}
            title="Select Images"
            onClick={() => {
              if (componentState.deleteMode) {
                setComponentState({ deleteMode: false, deleteSelection: [] })
              } else {
                setComponentState({
                  deleteMode: true,
                  showFilterMenu: false,
                  showLayoutMenu: false
                })
              }
            }}
          >
            <CircleCheckIcon size={24} />
          </MenuButton>
          <div className="relative">
            <MenuButton
              active={componentState.showFilterMenu}
              title="Filter images"
              onClick={handleFilterButtonClick}
            >
              <FilterIcon />
            </MenuButton>
            {componentState.showFilterMenu && (
              <DropDownMenu
                handleClose={() => {
                  setComponentState({
                    showFilterMenu: false
                  })
                }}
              >
                <DropDownMenuItem
                  onClick={() => {
                    setComponentState({
                      filterMode: 'all',
                      isLoading: componentState.filterMode !== 'all'
                    })

                    const newQuery = Object.assign({}, router.query)
                    delete newQuery.filter
                    delete newQuery.model
                    router.push(
                      //@ts-ignore
                      `?${new URLSearchParams(newQuery).toString()}`
                    )
                  }}
                >
                  Show all images
                </DropDownMenuItem>
                <DropDownMenuItem
                  onClick={() => {
                    setComponentState({
                      filterMode: 'favorited',
                      isLoading: componentState.filterMode !== 'favorited'
                    })

                    const newQuery = Object.assign({}, router.query)
                    newQuery.filter = 'favorited'
                    router.push(
                      //@ts-ignore
                      `?${new URLSearchParams(newQuery).toString()}`
                    )
                  }}
                >
                  Show favorited
                </DropDownMenuItem>
                <DropDownMenuItem
                  onClick={() => {
                    setComponentState({
                      filterMode: 'unfavorited',
                      isLoading: componentState.filterMode !== 'unfavorited'
                    })

                    const newQuery = Object.assign({}, router.query)
                    newQuery.filter = 'unfavorited'
                    router.push(
                      //@ts-ignore
                      `?${new URLSearchParams(newQuery).toString()}`
                    )
                  }}
                >
                  Show unfavorited
                </DropDownMenuItem>
                <DropDownMenuItem
                  onClick={() => {
                    setComponentState({
                      filterMode: 'upscaled',
                      isLoading: componentState.filterMode !== 'upscaled'
                    })

                    const newQuery = Object.assign({}, router.query)
                    newQuery.filter = 'upscaled'
                    router.push(
                      //@ts-ignore
                      `?${new URLSearchParams(newQuery).toString()}`
                    )
                  }}
                >
                  Show upscaled
                </DropDownMenuItem>
                <MenuSeparator />
                <DropDownMenuItem
                  onClick={() => {
                    setComponentState({
                      filterMode: 'text2img',
                      isLoading: componentState.filterMode !== 'text2img'
                    })

                    const newQuery = Object.assign({}, router.query)
                    newQuery.filter = 'text2img'
                    router.push(
                      //@ts-ignore
                      `?${new URLSearchParams(newQuery).toString()}`
                    )
                  }}
                >
                  text2img
                </DropDownMenuItem>
                <DropDownMenuItem
                  onClick={() => {
                    setComponentState({
                      filterMode: 'img2img',
                      isLoading: componentState.filterMode !== 'img2img'
                    })

                    const newQuery = Object.assign({}, router.query)
                    newQuery.filter = 'img2img'
                    router.push(
                      //@ts-ignore
                      `?${new URLSearchParams(newQuery).toString()}`
                    )
                  }}
                >
                  img2img
                </DropDownMenuItem>
                <DropDownMenuItem
                  onClick={() => {
                    setComponentState({
                      filterMode: 'inpainting',
                      isLoading: componentState.filterMode !== 'inpainting'
                    })

                    const newQuery = Object.assign({}, router.query)
                    newQuery.filter = 'inpainting'
                    router.push(
                      //@ts-ignore
                      `?${new URLSearchParams(newQuery).toString()}`
                    )
                  }}
                >
                  inpainting
                </DropDownMenuItem>
              </DropDownMenu>
            )}
          </div>
          <MenuButton
            active={componentState.showLayoutMenu}
            title="Change layout"
            onClick={() => {
              if (componentState.showLayoutMenu) {
                setComponentState({
                  showLayoutMenu: false
                })
              } else {
                setComponentState({
                  showFilterMenu: false,
                  showLayoutMenu: true
                })
              }
            }}
          >
            <DotsVerticalIcon size={24} />
          </MenuButton>
          {componentState.showLayoutMenu && (
            <DropDownMenu
              handleClose={() => {
                setComponentState({ showLayoutMenu: false })
              }}
            >
              {/* <MenuItem>Select images...</MenuItem>
                <MenuSeparator /> */}
              <DropDownMenuItem
                onClick={() => {
                  setComponentState({
                    layoutMode: 'grid'
                  })
                  localStorage.setItem('showLayout', 'grid')
                  trackEvent({
                    event: `MENU_CLICK`,
                    action: 'grid_view',
                    context: '/pages/images'
                  })
                }}
              >
                Square Grid
              </DropDownMenuItem>
              <DropDownMenuItem
                onClick={() => {
                  setComponentState({
                    layoutMode: 'layout'
                  })
                  localStorage.setItem('showLayout', 'layout')
                  trackEvent({
                    event: `MENU_CLICK`,
                    action: 'layout_view',
                    context: '/pages/images'
                  })
                }}
              >
                Dynamic Layout
              </DropDownMenuItem>
              <MenuSeparator />
              <DropDownMenuItem
                onClick={() => {
                  setComponentState({
                    isLoading: true,
                    sortMode: 'new'
                  })
                  localStorage.setItem('imagePageSort', 'new')
                  fetchImages()

                  const newQuery = Object.assign({}, router.query)
                  delete newQuery.sort
                  //@ts-ignore
                  router.push(`?${new URLSearchParams(newQuery).toString()}`)

                  trackEvent({
                    event: `MENU_CLICK`,
                    action: 'sort_new',
                    context: '/pages/images'
                  })
                }}
              >
                Sort by Newest
              </DropDownMenuItem>
              <DropDownMenuItem
                onClick={() => {
                  setComponentState({
                    isLoading: true,
                    sortMode: 'old'
                  })
                  localStorage.setItem('imagePageSort', 'old')
                  fetchImages()

                  const newQuery = Object.assign({}, router.query)
                  newQuery.sort = 'old'
                  //@ts-ignore
                  router.push(`?${new URLSearchParams(newQuery).toString()}`)

                  trackEvent({
                    event: `MENU_CLICK`,
                    action: 'sort_old',
                    context: '/pages/images'
                  })
                }}
              >
                Sort by Oldest
              </DropDownMenuItem>
            </DropDownMenu>
          )}
        </div>
      </div>
      <div className="mb-2 text-sm">
        <strong>Important:</strong> All images persist within your local browser
        cache and are not stored on a remote server. Clearing your cache will{' '}
        <strong>delete</strong> all images.
      </div>
      <div className="flex flex-row w-full justify-between">
        {!componentState.deleteMode && componentState.totalImages > 0 && (
          <div className="text-sm mb-2 text-teal-500">
            Showing {currentOffset} - {maxOffset} of{' '}
            <strong>{componentState.totalImages}</strong> {countDescriptor()}
            images {componentState.sortMode === 'new' && `(↓ newest)`}
            {componentState.sortMode === 'old' && `(↓ oldest)`}
          </div>
        )}
        {componentState.deleteMode && (
          <>
            <div className="text-sm mb-2 text-teal-500">
              selected ({componentState.deleteSelection.length})
            </div>
            <ButtonContainer>
              <TextButton
                onClick={() => {
                  setComponentState({ deleteMode: false, deleteSelection: [] })
                }}
                tabIndex={0}
              >
                cancel
              </TextButton>
              <TextButton
                onClick={() => {
                  handleSelectAll()
                }}
                tabIndex={0}
              >
                select all
              </TextButton>
              <TextButton onClick={handleDownloadClick} tabIndex={0}>
                download
              </TextButton>
              <TextButton
                color="red"
                onClick={() => {
                  if (componentState.deleteSelection.length > 0) {
                    setComponentState({ showDeleteModal: true })
                  }
                }}
                tabIndex={0}
              >
                delete
              </TextButton>
            </ButtonContainer>
          </>
        )}
      </div>
      {componentState.isLoading && <Spinner />}
      {!componentState.isLoading &&
        componentState.images.length === 0 &&
        componentState.filterMode !== 'all' && (
          <div className="mt-2 mb-2">
            No {countDescriptor()} images found for this filter.{' '}
            <Link
              href="/images"
              className="text-cyan-400"
              onClick={() => {
                setComponentState({
                  deleteMode: false,
                  filterMode: 'all',
                  showFilterMenu: false,
                  showLayoutMenu: false
                })
              }}
            >
              Reset filter and show all images.
            </Link>
          </div>
        )}
      {!componentState.isLoading &&
        componentState.images.length === 0 &&
        componentState.filterMode === 'all' && (
          <div className="mt-2 mb-2">
            You haven&apos;t created any images yet.{' '}
            <Link href="/" className="text-cyan-400">
              Why not create something?
            </Link>
          </div>
        )}
      <div className={defaultStyle}>
        {!componentState.isLoading &&
          componentState.images.length > 0 &&
          componentState.layoutMode === 'layout' && (
            <MasonryLayout columns={imageColumns} gap={8}>
              {componentState.images.map(
                (image: {
                  id: string
                  favorited: boolean
                  jobId: string
                  base64String: string
                  prompt: string
                  timestamp: number
                  seed: number
                }) => {
                  return (
                    <LazyLoad key={image.jobId} once>
                      <div className="relative">
                        <LinkEl
                          href={`/image/${image.jobId}`}
                          passHref
                          onClick={() => handleImageClick(image.id)}
                          tabIndex={0}
                        >
                          <img
                            src={'data:image/webp;base64,' + image.base64String}
                            style={{
                              borderRadius: '4px',
                              width: '100%',
                              display: 'block'
                            }}
                            alt={image.prompt}
                          />
                          {componentState.deleteMode &&
                            componentState.deleteSelection.indexOf(image.id) >=
                              0 && <ImageOverlay></ImageOverlay>}
                          {componentState.deleteMode &&
                            componentState.deleteSelection.indexOf(image.id) ===
                              -1 && <SelectCheck />}
                          {componentState.deleteMode &&
                            componentState.deleteSelection.indexOf(image.id) >=
                              0 && <SelectCheck fill="blue" stroke="white" />}
                          {image.favorited && (
                            <StyledHeartIcon
                              fill="#14B8A6"
                              width={2}
                              size={32}
                              shadow
                            />
                          )}
                        </LinkEl>
                      </div>
                    </LazyLoad>
                  )
                }
              )}
            </MasonryLayout>
          )}
        {!componentState.isLoading &&
          componentState.images.length > 0 &&
          componentState.layoutMode === 'grid' && (
            <>
              {componentState.images.map(
                (image: {
                  id: string
                  jobId: string
                  base64String: string
                  prompt: string
                  timestamp: number
                  seed: number
                  favorited: boolean
                }) => {
                  return (
                    <LazyLoad key={image.jobId} once>
                      <div className="relative">
                        <LinkEl
                          href={`/image/${image.jobId}`}
                          passHref
                          onClick={() => handleImageClick(image.id)}
                          tabIndex={0}
                        >
                          <ImageSquare
                            imageDetails={image}
                            imageType={'image/webp'}
                          />
                          {componentState.deleteMode &&
                            componentState.deleteSelection.indexOf(image.id) >=
                              0 && <ImageOverlay></ImageOverlay>}
                          {componentState.deleteMode &&
                            componentState.deleteSelection.indexOf(image.id) ===
                              -1 && <SelectCheck />}
                          {componentState.deleteMode &&
                            componentState.deleteSelection.indexOf(image.id) >=
                              0 && <SelectCheck fill="blue" stroke="white" />}
                          {image.favorited && (
                            <StyledHeartIcon
                              fill="#14B8A6"
                              width={2}
                              size={32}
                              shadow
                            />
                          )}
                        </LinkEl>
                      </div>
                    </LazyLoad>
                  )
                }
              )}
            </>
          )}
        {!componentState.isLoading &&
          componentState.images.length > 0 &&
          componentState.layoutMode === 'list' &&
          componentState.images.map(
            (image: {
              jobId: string
              base64String: string
              prompt: string
              timestamp: number
              seed: number
              height: number
              width: number
            }) => {
              return (
                <ImageCard
                  key={image.jobId}
                  imageDetails={image}
                  handleDeleteImageClick={handleDeleteImageClick}
                />
              )
            }
          )}
      </div>
      {!componentState.isLoading && componentState.totalImages > 100 && (
        <div className="flex flex-row justify-center gap-2 mt-4">
          <Button
            disabled={componentState.offset === 0}
            onClick={() => handleLoadMore('first')}
            width="52px"
          >
            First
          </Button>
          <Button
            disabled={componentState.offset === 0}
            onClick={() => handleLoadMore('prev')}
            width="52px"
          >
            Prev
          </Button>
          <Button
            disabled={currentOffset >= componentState.totalImages - 99}
            onClick={() => handleLoadMore('next')}
            width="52px"
          >
            Next
          </Button>
          <Button
            disabled={currentOffset >= componentState.totalImages - 99}
            onClick={() => handleLoadMore('last')}
            width="52px"
          >
            Last
          </Button>
        </div>
      )}
    </div>
  )
}

export default ImagesPage
