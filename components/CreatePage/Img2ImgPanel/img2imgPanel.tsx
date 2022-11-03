import React, { useState } from 'react'
import styled from 'styled-components'

import { Button } from '../../UI/Button'
import Dropzone from '../../Dropzone/dropzone'
import { getImageFromUrl } from '../../../utils/imageUtils'
import Input from '../../UI/Input'
import Image from '../../Image'
import TrashIcon from '../../icons/TrashIcon'
import { SourceProcessing } from '../../../utils/promptUtils'
import Uploader from '../Uploader'

interface FlexRowProps {
  bottomPadding?: number
}

const FlexRow = styled.div<FlexRowProps>`
  align-items: flex-start;
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  gap: 8px;
  width: 100%;

  ${(props) =>
    props.bottomPadding &&
    `
    padding-bottom: ${props.bottomPadding}px;
  `}
`

const Section = styled.div`
  padding-top: 16px;

  &:first-child {
    padding-top: 0;
  }
`

const SubSectionTitle = styled.div`
  padding-bottom: 8px;
`

interface Props {
  handleChangeInput: any
  handleImageUpload: any
  handleOrientationSelect: any
  input: any
  setInput: any
}

const Img2ImgPanel = ({ input, setInput }: Props) => {
  const [imgUrl, setImgUrl] = useState('')
  const [imgUrlError, setImgUrlError] = useState('')

  const saveImage = ({
    imageType = '',
    source_image = '',
    height = 512,
    width = 512
  }) => {
    setInput({
      img2img: true,
      imageType,
      height,
      width,
      source_image,
      source_processing: 'img2img'
    })
  }

  const handleImportFromUrl = async () => {
    if (!imgUrl) {
      return
    }

    const data = await getImageFromUrl(imgUrl)
    const { success, message, imageType, imgBase64String, height, width } = data

    if (!success) {
      setImgUrlError(message || '')
      return
    }

    setImgUrlError('')
    saveImage({ imageType, source_image: imgBase64String, height, width })
  }

  return (
    <div>
      <Section>
        {!input.source_image && <Uploader handleSaveImage={saveImage} />}
        {input.source_image && (
          <>
            <div className="flex flex-row mb-4">
              <Button
                btnType="secondary"
                onClick={() =>
                  setInput({
                    img2img: false,
                    imageType: '',
                    height: 512,
                    width: 512,
                    source_image: '',
                    source_processing: SourceProcessing.Prompt
                  })
                }
              >
                <TrashIcon />
                Clear
              </Button>
            </div>
            <div className="flex flex-row align-top justify-around w-full mx-auto">
              <Image
                base64String={input.source_image}
                alt="Test"
                imageType={input.imageType}
                height={input.height}
                width={input.width}
              />
            </div>
          </>
        )}
      </Section>
    </div>
  )
}

export default Img2ImgPanel