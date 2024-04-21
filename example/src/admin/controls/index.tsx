import { useMemo } from 'react';
import { useAdminContext } from '../admin-context';

import AppBar from './AppBar';
import Button, { IconButton, NavigationButton } from './Button';
import Checkbox from './Checkbox';
import Modal from './Modal';
import Popover from './Popover';
import Radiobutton from './Radiobutton';
import Select from './Select';
import TextArea from './TextArea';
import TextInput from './TextInput';

// These control implementations are what the admin panel uses by default
// They can be easily overriden by setting them on `AdminContext`
const baseControls = {
  AppBar,
  Button,
  IconButton,
  NavigationButton,
  Checkbox,
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
