import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field, FormError } from "./field";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

const meta = {
  title: "Components/Field",
  component: Field,
  tags: ["autodocs"],
  args: { label: "Email", children: null },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Field label="Email" className="max-w-xs">
      {(control) => <Input type="email" placeholder="you@company.com" {...control} />}
    </Field>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <Field label="Organization name" description="Shown to everyone in the workspace." required className="max-w-xs">
      {(control) => <Input placeholder="Acme Inc." {...control} />}
    </Field>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field label="Email" error="Enter a valid email address" required className="max-w-xs">
      {(control) => <Input type="email" defaultValue="not-an-email" {...control} />}
    </Field>
  ),
};

export const WithLabelAction: Story = {
  render: () => (
    <Field
      label="Password"
      labelAction={
        <a href="#" className="text-sm text-primary hover:underline">
          Forgot password?
        </a>
      }
      className="max-w-xs"
    >
      {(control) => <Input type="password" {...control} />}
    </Field>
  ),
};

export const WithTextarea: Story = {
  render: () => (
    <Field label="Description" className="max-w-sm">
      {(control) => <Textarea placeholder="What needs to happen?" {...control} />}
    </Field>
  ),
};

export const WithSelect: Story = {
  render: () => (
    <Field label="Role" error="Choose a role" className="max-w-xs">
      {(control) => (
        <Select>
          <SelectTrigger className="w-full" {...control}>
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      )}
    </Field>
  ),
};

export const FormLevelError: Story = {
  render: () => <FormError className="max-w-xs">Incorrect email or password</FormError>,
};
