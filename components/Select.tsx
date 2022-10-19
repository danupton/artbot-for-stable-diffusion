import React from 'react'
import styled from 'styled-components'

interface SelectProps {
  name?: string
  children?: React.ReactNode
  onChange: any
  width?: string
  value?: string
}

const StyledSelect = styled.select<SelectProps>`
  background-color: rgb(42, 48, 60);
  border-radius: 4px;
  border: 1px solid white;
  color: #e1e1e1;
  font-size: 14px;
  height: 39px;
  padding: 8px;
  width: ${(props) => (props.width ? props.width : '120px')};
`

const Select = (props: SelectProps) => {
  const { children, ...rest } = props
  return <StyledSelect {...rest}>{children}</StyledSelect>
}

export default Select