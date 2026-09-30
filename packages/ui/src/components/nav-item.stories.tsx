import type { Meta, StoryObj } from "@storybook/react-vite";
import { HomeIcon, FolderIcon, SettingsIcon } from "lucide-react";

import { NavItem } from "./nav-item";

const meta = {
  title: "Components/NavItem",
  component: NavItem,
  tags: ["autodocs"],
} satisfies Meta<typeof NavItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  render: () => (
    <div className="flex w-48 flex-col gap-0.5">
      <NavItem href="#" icon={<HomeIcon />} active>
        Home
      </NavItem>
      <NavItem href="#" icon={<FolderIcon />}>
        Projects
      </NavItem>
      <NavItem href="#" icon={<SettingsIcon />}>
        Settings
      </NavItem>
    </div>
  ),
};
