import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "Components/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Manage user</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Reset password</DropdownMenuItem>
        <DropdownMenuItem>Change role</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Delete user</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
