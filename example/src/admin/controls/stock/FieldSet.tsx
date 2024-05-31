type FieldSetProps = {
  label: React.ReactNode;
  children: React.ReactNode;
};

const FieldSet: React.FunctionComponent<FieldSetProps> = ({ label, children }) => (
  <fieldset style={{ padding: 16 }}>
    <legend>{label}</legend>
    {children}
  </fieldset>
);

export default FieldSet;
