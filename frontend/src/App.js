import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import BudgetsPage from "@/pages/BudgetsPage";
import BudgetTemplatePage from "@/pages/BudgetTemplatePage";
import CalendarPage from "@/pages/CalendarPage";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="budgets/new" element={<BudgetTemplatePage />} />
            <Route path="budgets/:id" element={<BudgetTemplatePage />} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
