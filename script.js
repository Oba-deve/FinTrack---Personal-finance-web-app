
const STORAGE_KEY = 'fintrack_transactions';


function loadTransactions() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to parse transactions from localStorage:', error);
    }

    return [];
}


function saveTransactions(transactions) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (error) {
        console.error('Failed to save transactions to localStorage:', error);
    }
}


let transactions = loadTransactions();
let currentFilter = 'all'; // 'all' | 'income' | 'expense'
let expenseChart = null;   // Chart.js instance

const form = document.getElementById('transactionForm');
const totalBalanceEl = document.getElementById('totalBalance');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const transactionListEl = document.getElementById('transactionList');
const emptyStateEl = document.getElementById('emptyState');
const filterButtons = document.querySelectorAll('.filter-btn');
const clearDataBtn = document.getElementById('clearDataBtn');
const dateInput = document.getElementById('date');


function updateTotals() {
    let income = 0;
    let expense = 0;

    for (const t of transactions) {
        if (t.type === 'income') {
            income += t.amount;
        } else {
            expense += t.amount;
        }
    }

    const balance = income - expense;

    totalBalanceEl.textContent = formatCurrency(balance);
    totalIncomeEl.textContent = formatCurrency(income);
    totalExpenseEl.textContent = formatCurrency(expense);
}


function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}


function renderTransactions() {

    const filtered = transactions.filter((t) => {
        if (currentFilter === 'all') return true;
        return t.type === currentFilter;
    });


    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));


    transactionListEl.innerHTML = '';

    if (filtered.length === 0) {
        emptyStateEl.classList.remove('hidden');
    } else {
        emptyStateEl.classList.add('hidden');

        for (const t of filtered) {
            const row = createTransactionRow(t);
            transactionListEl.appendChild(row);
        }
    }
}


function createTransactionRow(transaction) {
    const row = document.createElement('div');
    row.className =
        'flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group';

    const isIncome = transaction.type === 'income';
    const amountClass = isIncome ? 'text-emerald-600' : 'text-rose-600';
    const sign = isIncome ? '+' : '-';

    row.innerHTML = `
    <div class="flex items-center gap-4 min-w-0">
      <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getCategoryColor(
        transaction.category
    )}">
        <span class="text-sm font-semibold">${getCategoryInitial(
        transaction.category
    )}</span>
      </div>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(
        transaction.description
    )}</p>
        <p class="text-xs text-slate-500">${formatDate(transaction.date)} · ${escapeHtml(
        transaction.category
    )}</p>
      </div>
    </div>
    <div class="flex items-center gap-4 flex-shrink-0">
      <span class="text-sm font-bold ${amountClass}">${sign}${formatCurrency(
        transaction.amount
    )}</span>
      <button
        data-id="${transaction.id}"
        class="delete-btn opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
        aria-label="Delete transaction"
        title="Delete"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  `;


    const deleteBtn = row.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteTransaction(transaction.id));

    return row;
}


function deleteTransaction(id) {
    transactions = transactions.filter((t) => t.id !== id);
    saveTransactions(transactions);
    renderTransactions();
    updateTotals();
    updateChart();
}


form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const type = formData.get('type');
    const amount = parseFloat(formData.get('amount'));
    const description = formData.get('description').trim();
    const category = formData.get('category');
    const date = formData.get('date');

    if (!description || Number.isNaN(amount) || amount <= 0 || !date) {
        return;
    }

    const newTransaction = {
        id: Date.now().toString(),
        type,
        amount,
        description,
        category,
        date
    };

    transactions.push(newTransaction);
    saveTransactions(transactions);

    form.reset();
    dateInput.valueAsDate = new Date();

    renderTransactions();
    updateTotals();
    updateChart();
});


filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        filterButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        currentFilter = button.dataset.filter;
        renderTransactions();
    });
});


function updateChart() {
    const expenses = transactions.filter((t) => t.type === 'expense');
    const categoryTotals = {};

    for (const t of expenses) {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    }

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const emptyMessage = document.getElementById('emptyChartMessage');
    const ctx = document.getElementById('expenseChart').getContext('2d');

    if (labels.length === 0) {
        if (expenseChart) {
            expenseChart.destroy();
            expenseChart = null;
        }
        emptyMessage.classList.remove('hidden');
        return;
    }

    emptyMessage.classList.add('hidden');

    const backgroundColors = [
        '#2563EB',
        '#0EA5E9',
        '#10B981',
        '#F59E0B',
        '#EF4444',
        '#8B5CF6',
        '#EC4899',
        '#64748B'
    ];

    if (expenseChart) {
        expenseChart.data.labels = labels;
        expenseChart.data.datasets[0].data = data;
        expenseChart.data.datasets[0].backgroundColor = backgroundColors.slice(
            0,
            labels.length
        );
        expenseChart.update();
    } else {
        expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [
                    {
                        data,
                        backgroundColor: backgroundColors.slice(0, labels.length),
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverOffset: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 16,
                            font: {
                                size: 12,
                                family: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont'
                            },
                            color: '#475569'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                            }
                        },
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                cutout: '60%'
            }
        });
    }
}


clearDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all transaction history? This cannot be undone.')) {
        transactions = [];
        saveTransactions(transactions);
        currentFilter = 'all';
        filterButtons.forEach((btn) => btn.classList.remove('active'));
        filterButtons[0].classList.add('active');
        renderTransactions();
        updateTotals();
        updateChart();
    }
});


function getCategoryColor(category) {
    const colors = {
        Salary: 'bg-emerald-100 text-emerald-700',
        Freelance: 'bg-teal-100 text-teal-700',
        Investments: 'bg-cyan-100 text-cyan-700',
        Food: 'bg-amber-100 text-amber-700',
        Rent: 'bg-blue-100 text-blue-700',
        Transport: 'bg-indigo-100 text-indigo-700',
        Entertainment: 'bg-pink-100 text-pink-700',
        Utilities: 'bg-orange-100 text-orange-700',
        Other: 'bg-slate-100 text-slate-700'
    };
    return colors[category] || colors.Other;
}


function getCategoryInitial(category) {
    return category ? category.charAt(0).toUpperCase() : '?';
}


function formatDate(isoDate) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(isoDate).toLocaleDateString('en-US', options);
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


dateInput.valueAsDate = new Date();
renderTransactions();
updateTotals();
updateChart();
