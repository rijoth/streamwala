import React from 'react';
import { TextField } from '../../shared/ui/index.ts';

export interface SearchFieldProps {
  /** Focus key the Yellow remote key and the screen focus targets point at. */
  focusKey: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Compact inline search field shared by Home, Live TV and Favorites.
 *
 * Never auto-focuses: the screen owns where focus starts, and typing must not
 * pull the D-pad into the field on mount.
 */
export const SearchField: React.FC<SearchFieldProps> = ({
  focusKey,
  value,
  onChange,
  label = 'Search channels',
  placeholder = 'Search by name, number or category',
  className,
}) => (
  <TextField
    variant="compact"
    focusKey={focusKey}
    label={label}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    icon="search"
    autoFocus={false}
    className={className}
  />
);
