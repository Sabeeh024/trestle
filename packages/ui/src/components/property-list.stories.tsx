import type { Meta, StoryObj } from "@storybook/react-vite";

import { PropertyItem, PropertyList } from "./property-list";

const meta = {
  title: "Components/PropertyList",
  component: PropertyList,
  tags: ["autodocs"],
} satisfies Meta<typeof PropertyList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <PropertyList className="w-72">
      <PropertyItem label="Organization">Northwind</PropertyItem>
      <PropertyItem label="Role">Admin</PropertyItem>
      <PropertyItem label="Joined">Jan 14, 2025</PropertyItem>
      <PropertyItem label="User ID">
        <span className="font-mono text-xs text-text-tertiary">usr_000001</span>
      </PropertyItem>
    </PropertyList>
  ),
};
