import { useMemo } from 'react';
import { useAdminContext } from '../admin-context';

import {
  AppBar,
  Button,
  IconButton,
  NavigationButton,
  NavigationLink,
  Checkbox,
  FieldSet,
  Modal,
  Popover,
  Radiobutton,
  Select,
  TextArea,
  TextInput,
} from './stock';

export type SelectOption = { value: string, label: React.ReactNode, disabled?: boolean };

// These control implementations are what the admin panel uses by default
// They can be easily overriden by setting them on `AdminContext`
const baseControls = {
  AppBar,
  Button,
  IconButton,
  NavigationButton,
  NavigationLink,
  Checkbox,
  FieldSet,
  Modal,
  Popover,
  Radiobutton,
  Select,
  TextArea,
  TextInput,
};

export type Controls = Partial<typeof baseControls>;


export const useControls = () => {
  const adminContext = useAdminContext();

  return useMemo(() => {
    if (!adminContext || !adminContext.controls) {
      return baseControls;
    }

    return { ...baseControls, ...adminContext.controls };
  }, [adminContext]);
};
