'use client'

import type React from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/16/solid'
import { Input, InputGroup } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'

/**
 * Filter/search toolbar for admin list pages. Search input on the left,
 * filter Selects next, right-aligned actions, and an optional count on the
 * far right. Wraps on small screens. Client component (controlled inputs).
 *
 * All state is owned by the parent — this is a thin controlled presentational
 * wrapper over Catalyst Input/Select.
 */
export interface AdminToolbarFilter {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
}

export interface AdminToolbarProps {
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  filters?: AdminToolbarFilter[]
  actions?: React.ReactNode
  /** Result count / summary, right-aligned. */
  count?: React.ReactNode
}

export function AdminToolbar({ search, filters, actions, count }: AdminToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {search ? (
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <InputGroup>
            <MagnifyingGlassIcon data-slot="icon" />
            <Input
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Rechercher…'}
              aria-label={search.placeholder ?? 'Rechercher'}
            />
          </InputGroup>
        </div>
      ) : null}

      {filters?.map((filter) => (
        <label key={filter.label} className="flex items-center gap-2">
          <span className="sr-only">{filter.label}</span>
          <div className="w-40">
            <Select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              aria-label={filter.label}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </label>
      ))}

      {(actions || count) && (
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {count ? <span className="text-xs/5 text-zinc-500 dark:text-zinc-400">{count}</span> : null}
          {actions}
        </div>
      )}
    </div>
  )
}
