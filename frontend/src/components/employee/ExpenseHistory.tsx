"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Expense, expensesApi } from "@/lib/api";
import { useSocket } from "@/providers/SocketProvider";
import { History, Receipt, Loader2 } from "lucide-react";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary" className="bg-gray-500/20 text-gray-300">Draft</Badge>;
    case "WAITING_APPROVAL":
      return <Badge variant="outline" className="border-amber-500/50 text-amber-500 bg-amber-500/10">Pending</Badge>;
    case "APPROVED":
      return <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/30">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive" className="bg-destructive/20 text-destructive-foreground">Rejected</Badge>;
    default:
      return null;
  }
};

export function ExpenseHistory() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocket();

  const fetchExpenses = useCallback(async () => {
    try {
      const data = await expensesApi.list();
      setExpenses(data.expenses);
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchExpenses();
    };

    socket.on("expense_approved", handleUpdate);
    socket.on("expense_rejected", handleUpdate);
    socket.on("expense_submitted", handleUpdate);

    return () => {
      socket.off("expense_approved", handleUpdate);
      socket.off("expense_rejected", handleUpdate);
      socket.off("expense_submitted", handleUpdate);
    };
  }, [socket, fetchExpenses]);

  const logs = selectedExpense?.approvalLogs || [];

  return (
    <>
      <Card className="bg-card/40 backdrop-blur-xl border-white/5 h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="w-5 h-5" />
            My Expenses
          </CardTitle>
          <CardDescription>Click any row to view full approval timeline</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-md">
              <TableRow className="border-border">
                <TableHead className="font-semibold px-4 py-3">Description</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
                <TableHead className="font-semibold text-center w-32">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    <Loader2 className="w-10 h-10 mx-auto animate-spin opacity-20 mb-3" />
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto opacity-20 mb-3" />
                    No expenses found.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow 
                    key={expense.id} 
                    className="cursor-pointer hover:bg-muted/50 border-border group transition-all"
                    onClick={() => setSelectedExpense(expense)}
                  >
                    <TableCell className="font-medium px-4 py-3">
                      {expense.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{expense.category}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(expense.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {expense.currency === "USD" ? "$" : expense.currency + " "}{expense.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(expense.status)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedExpense} onOpenChange={(open) => !open && setSelectedExpense(null)}>
        <DialogContent className="sm:max-w-md border-border bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Approval Timeline</DialogTitle>
            <DialogDescription>
              {selectedExpense?.description} - {selectedExpense?.currency} {selectedExpense?.amount.toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          {selectedExpense?.status === "WAITING_APPROVAL" && selectedExpense.rule && (
            <div className="mt-4 px-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Approval Progress</span>
                <span>{selectedExpense.approvalLogs.length} / {(selectedExpense.rule.steps?.length || 0) + (selectedExpense.rule.includeDirectManager ? 1 : 0)} steps</span>
              </div>
              <Progress 
                value={
                  Math.min(((selectedExpense.approvalLogs.length) / ((selectedExpense.rule.steps?.length || 0) + (selectedExpense.rule.includeDirectManager ? 1 : 0))) * 100, 100)
                } 
                className="h-1.5"
              />
            </div>
          )}
          
          <div className="py-4">
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No approval actions recorded yet.
              </div>
            ) : (
              <div className="space-y-6 relative border-l border-border ml-4 pl-6">
                {logs.map((log, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-4 border-card bg-background mt-1 ${log.action === "APPROVED" ? "bg-green-500" : "bg-destructive"}`} />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{log.approver.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-[10px] ${log.action === "APPROVED" ? "text-green-500 border-green-500/20" : "text-destructive border-destructive/20"}`}>
                          {log.action}
                        </Badge>
                        {log.comment && <span className="text-sm text-foreground/80 italic">"{log.comment}"</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {selectedExpense?.approvalReason && (
              <div className="mt-6 p-3 rounded-lg bg-primary/5 border border-primary/10 flex gap-3 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Engine Decision</p>
                  <p className="text-xs text-foreground/80 italic leading-snug">"{selectedExpense.approvalReason}"</p>
                </div>
              </div>
            )}
            
            {/* Future steps logic mocking */}
            {selectedExpense?.status === "WAITING_APPROVAL" && (
               <div className="relative border-l border-border ml-4 pl-6 pt-6">
                 <div className="absolute -left-[31px] w-4 h-4 rounded-full border-4 border-card bg-muted mt-1" />
                 <span className="text-sm text-muted-foreground opacity-70 animate-pulse">Waiting for next approver...</span>
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
