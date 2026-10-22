'use client'

import React, { useMemo } from 'react'
import { CustomSelect, type SelectOption } from './CustomSelect'

interface SelectFieldProps {
  value: string | number | undefined | null
  onChange: (value: string) => void
  /** Elementos <option> y <optgroup>, igual que en un <select> nativo. */
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  error?: boolean | string
  id?: string
  name?: string
  className?: string
  placeholder?: string
  searchable?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
}

const nodeText = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

interface OptionElementProps {
  value?: string | number
  disabled?: boolean
  label?: string
  children?: React.ReactNode
}

function collectOptions(children: React.ReactNode, group?: string, out: SelectOption[] = []): SelectOption[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<OptionElementProps>(child)) return
    if (child.type === React.Fragment) {
      collectOptions(child.props.children, group, out)
      return
    }
    if (child.type === 'optgroup') {
      collectOptions(child.props.children, child.props.label, out)
      return
    }
    if (child.type === 'option') {
      const label = nodeText(child.props.children).replace(/\s+/g, ' ').trim()
      out.push({
        value: child.props.value !== undefined ? String(child.props.value) : label,
        label,
        disabled: child.props.disabled,
        group,
      })
    }
  })
  return out
}

/**
 * Selector con el estilo del sistema que acepta hijos <option>/<optgroup> como un <select> nativo.
 * La primera opción con valor vacío se usa como texto de marcador.
 */
export function SelectField({ value, onChange, children, placeholder, ...rest }: SelectFieldProps) {
  const options = useMemo(() => collectOptions(children), [children])
  const emptyOption = options.find((opt) => opt.value === '')

  return (
    <CustomSelect
      {...rest}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={onChange}
      options={options}
      placeholder={placeholder ?? emptyOption?.label}
    />
  )
}
