import type { Meta, StoryObj } from "@storybook/react-vite";

import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { PropertyItem, PropertyList } from "./property-list";
import { SidePanel, SidePanelBody, SidePanelFooter, SidePanelHeader } from "./side-panel";

const meta = {
  title: "Components/SidePanel",
  component: SidePanel,
  tags: ["autodocs"],
} satisfies Meta<typeof SidePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UserDetail: Story = {
  args: { "aria-label": "User detail" },
  render: (args) => (
    <SidePanel {...args} className="h-screen max-h-125">
      <SidePanelHeader onClose={() => {}}>User detail</SidePanelHeader>
      <SidePanelBody>
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>AK</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[15px] font-bold">Alex Kim</p>
            <p className="text-xs text-text-secondary">alex.kim@northwind.io</p>
          </div>
        </div>
        <PropertyList>
          <PropertyItem label="Status">
            <Badge variant="success" dot>
              Active
            </Badge>
          </PropertyItem>
          <PropertyItem label="Organization">Northwind</PropertyItem>
          <PropertyItem label="Role">Admin</PropertyItem>
        </PropertyList>
      </SidePanelBody>
      <SidePanelFooter>
        <Button variant="outline" className="w-full">
          Reset password
        </Button>
      </SidePanelFooter>
    </SidePanel>
  ),
};
