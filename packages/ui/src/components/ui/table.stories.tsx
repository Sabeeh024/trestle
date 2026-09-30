import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

const meta = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { name: "Alex Kim", email: "alex.kim@northwind.io", status: "active" as const },
  { name: "Maya Patel", email: "maya@fontaineco.com", status: "active" as const },
  { name: "Tom Baker", email: "tom.baker@haldane.co", status: "suspended" as const },
];

const statusVariant = {
  active: "success",
  suspended: "destructive",
} as const;

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.email}>
            <TableCell className="font-semibold text-text-primary">{row.name}</TableCell>
            <TableCell className="text-text-secondary">{row.email}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[row.status]} dot className="capitalize">
                {row.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
