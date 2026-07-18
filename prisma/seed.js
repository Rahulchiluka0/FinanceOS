import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding FinanceOS database...')

  await prisma.notification.deleteMany()
  await prisma.transactionTag.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.budget.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.recurringRule.deleteMany()
  await prisma.bill.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.loan.deleteMany()
  await prisma.investment.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.category.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await bcrypt.hash('demo1234', 10)
  const user = await prisma.user.create({
    data: {
      name: 'Aarav Mehta',
      email: 'aarav@example.com',
      passwordHash,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      theme: 'light',
    },
  })

  const [hdfc, cash, paytm, icici, sbi] = await Promise.all([
    prisma.account.create({
      data: { userId: user.id, name: 'HDFC Savings', type: 'bank', openingBalance: 200000, balance: 245800, color: '#1A56DB' },
    }),
    prisma.account.create({
      data: { userId: user.id, name: 'Cash Wallet', type: 'cash', openingBalance: 5000, balance: 8500, color: '#EA580C' },
    }),
    prisma.account.create({
      data: { userId: user.id, name: 'Paytm UPI', type: 'upi', openingBalance: 0, balance: 12450, color: '#0284C7' },
    }),
    prisma.account.create({
      data: { userId: user.id, name: 'ICICI Credit', type: 'credit_card', openingBalance: 0, balance: -18200, color: '#DC2626' },
    }),
    prisma.account.create({
      data: { userId: user.id, name: 'SBI Salary', type: 'bank', openingBalance: 150000, balance: 180100, color: '#334155' },
    }),
  ])

  const salary = await prisma.category.create({
    data: { userId: user.id, name: 'Salary', type: 'income', color: '#1A56DB', icon: 'Briefcase' },
  })
  const freelance = await prisma.category.create({
    data: { userId: user.id, name: 'Freelance', type: 'income', color: '#0284C7', icon: 'Laptop' },
  })
  const food = await prisma.category.create({
    data: { userId: user.id, name: 'Food & Dining', type: 'expense', color: '#EA580C', icon: 'Utensils' },
  })
  await prisma.category.create({
    data: { userId: user.id, name: 'Groceries', type: 'expense', color: '#F97316', icon: 'ShoppingBasket', parentId: food.id },
  })
  const transport = await prisma.category.create({
    data: { userId: user.id, name: 'Transport', type: 'expense', color: '#475569', icon: 'Car' },
  })
  const shopping = await prisma.category.create({
    data: { userId: user.id, name: 'Shopping', type: 'expense', color: '#DC2626', icon: 'ShoppingBag' },
  })
  const billsCat = await prisma.category.create({
    data: { userId: user.id, name: 'Bills', type: 'expense', color: '#64748B', icon: 'Receipt' },
  })
  const entertainment = await prisma.category.create({
    data: { userId: user.id, name: 'Entertainment', type: 'expense', color: '#7C3AED', icon: 'Clapperboard' },
  })

  const tag = async (name, color) =>
    prisma.tag.create({ data: { userId: user.id, name, color } })

  const tSalary = await tag('salary', '#1A56DB')
  const tFood = await tag('food', '#EA580C')
  const tCommute = await tag('commute', '#475569')
  const tUtilities = await tag('utilities', '#64748B')
  const tShopping = await tag('shopping', '#DC2626')
  const tSide = await tag('side', '#0284C7')
  const tSub = await tag('subscription', '#7C3AED')

  async function tx({ title, type, amount, date, accountId, categoryId, tags = [], notes = '', favorite = false }) {
    const row = await prisma.transaction.create({
      data: {
        userId: user.id,
        title,
        type,
        amount,
        date: new Date(date),
        accountId,
        categoryId,
        notes,
        favorite,
      },
    })
    for (const tagId of tags) {
      await prisma.transactionTag.create({ data: { transactionId: row.id, tagId } })
    }
    return row
  }

  await tx({ title: 'Salary — Acme Corp', type: 'income', amount: 125000, date: '2026-07-01', accountId: sbi.id, categoryId: salary.id, tags: [tSalary.id], favorite: true })
  await tx({ title: 'Swiggy Order', type: 'expense', amount: 640, date: '2026-07-15', accountId: paytm.id, categoryId: food.id, tags: [tFood.id] })
  await tx({ title: 'Uber Ride', type: 'expense', amount: 320, date: '2026-07-14', accountId: hdfc.id, categoryId: transport.id, tags: [tCommute.id] })
  await tx({ title: 'Electricity Bill', type: 'expense', amount: 2840, date: '2026-07-12', accountId: hdfc.id, categoryId: billsCat.id, tags: [tUtilities.id], notes: 'BESCOM' })
  await tx({ title: 'Amazon Purchase', type: 'expense', amount: 4599, date: '2026-07-11', accountId: icici.id, categoryId: shopping.id, tags: [tShopping.id] })
  await tx({ title: 'Freelance Project', type: 'income', amount: 28000, date: '2026-07-10', accountId: hdfc.id, categoryId: freelance.id, tags: [tSide.id], favorite: true })
  await tx({ title: 'Netflix', type: 'expense', amount: 649, date: '2026-07-08', accountId: paytm.id, categoryId: entertainment.id, tags: [tSub.id] })
  await prisma.transaction.create({
    data: {
      userId: user.id,
      title: 'Transfer to Cash',
      type: 'transfer',
      amount: 5000,
      date: new Date('2026-07-07'),
      accountId: hdfc.id,
      toAccountId: cash.id,
      notes: 'ATM',
    },
  })

  await prisma.budget.createMany({
    data: [
      { userId: user.id, categoryId: food.id, period: 'monthly', limitAmount: 20000, alertAt: 80 },
      { userId: user.id, categoryId: transport.id, period: 'monthly', limitAmount: 10000, alertAt: 80 },
      { userId: user.id, categoryId: shopping.id, period: 'monthly', limitAmount: 15000, alertAt: 80 },
      { userId: user.id, categoryId: entertainment.id, period: 'monthly', limitAmount: 8000, alertAt: 80 },
      { userId: user.id, categoryId: billsCat.id, period: 'monthly', limitAmount: 25000, alertAt: 80 },
    ],
  })

  await prisma.goal.createMany({
    data: [
      { userId: user.id, name: 'Emergency Fund', targetAmount: 300000, currentAmount: 185000, deadline: new Date('2026-12-31'), color: '#1A56DB' },
      { userId: user.id, name: 'Goa Trip', targetAmount: 80000, currentAmount: 52000, deadline: new Date('2026-10-15'), color: '#EA580C' },
      { userId: user.id, name: 'New Laptop', targetAmount: 120000, currentAmount: 45000, deadline: new Date('2027-01-31'), color: '#0284C7' },
    ],
  })

  await prisma.recurringRule.createMany({
    data: [
      { userId: user.id, title: 'Rent', type: 'expense', amount: 22000, frequency: 'monthly', nextDate: new Date('2026-08-01'), accountId: hdfc.id, status: 'active' },
      { userId: user.id, title: 'Gym Membership', type: 'expense', amount: 1500, frequency: 'monthly', nextDate: new Date('2026-08-05'), accountId: paytm.id, status: 'active' },
      { userId: user.id, title: 'SIP — Index Fund', type: 'expense', amount: 10000, frequency: 'monthly', nextDate: new Date('2026-08-03'), accountId: hdfc.id, status: 'active' },
      { userId: user.id, title: 'Salary Credit', type: 'income', amount: 125000, frequency: 'monthly', nextDate: new Date('2026-08-01'), accountId: sbi.id, status: 'active' },
      { userId: user.id, title: 'Spotify', type: 'expense', amount: 119, frequency: 'monthly', nextDate: new Date('2026-07-22'), accountId: paytm.id, status: 'paused' },
    ],
  })

  await prisma.bill.createMany({
    data: [
      { userId: user.id, title: 'Rent', category: 'Rent', amount: 22000, dueDate: new Date('2026-08-01'), status: 'unpaid', accountId: hdfc.id },
      { userId: user.id, title: 'Internet Bill', category: 'Utilities', amount: 999, dueDate: new Date('2026-07-20'), status: 'unpaid', accountId: paytm.id },
      { userId: user.id, title: 'Electricity', category: 'Utilities', amount: 2840, dueDate: new Date('2026-07-28'), status: 'paid', accountId: hdfc.id },
      { userId: user.id, title: 'Health Insurance', category: 'Insurance', amount: 4500, dueDate: new Date('2026-07-28'), status: 'unpaid', accountId: sbi.id },
      { userId: user.id, title: 'ICICI Credit Card', category: 'Credit cards', amount: 18200, dueDate: new Date('2026-07-25'), status: 'unpaid', accountId: hdfc.id },
    ],
  })

  await prisma.subscription.createMany({
    data: [
      { userId: user.id, name: 'Netflix', amount: 649, cycle: 'monthly', nextRenewal: new Date('2026-08-08'), status: 'active' },
      { userId: user.id, name: 'Spotify', amount: 119, cycle: 'monthly', nextRenewal: new Date('2026-07-22'), status: 'active' },
      { userId: user.id, name: 'ChatGPT Plus', amount: 1650, cycle: 'monthly', nextRenewal: new Date('2026-08-01'), status: 'active' },
    ],
  })

  await prisma.loan.createMany({
    data: [
      { userId: user.id, name: 'Home Loan', principal: 2500000, remaining: 1840000, interestRate: 8.4, emi: 22450, nextDue: new Date('2026-08-05'), tenureMonths: 180, paidMonths: 42 },
      { userId: user.id, name: 'Car Loan', principal: 600000, remaining: 218000, interestRate: 9.1, emi: 12500, nextDue: new Date('2026-08-10'), tenureMonths: 60, paidMonths: 38 },
    ],
  })

  await prisma.investment.createMany({
    data: [
      { userId: user.id, name: 'Nifty BeES', type: 'Mutual Funds', invested: 150000, currentValue: 185000 },
      { userId: user.id, name: 'TCS', type: 'Stocks', invested: 78000, currentValue: 92000 },
      { userId: user.id, name: 'HDFC FD', type: 'FDs', invested: 200000, currentValue: 220000 },
    ],
  })

  await prisma.notification.createMany({
    data: [
      { userId: user.id, type: 'budget', title: 'Budget alert', body: 'Shopping budget exceeded by ₹600', read: false },
      { userId: user.id, type: 'bill', title: 'Bill due', body: 'Internet Bill of ₹999 due on 20 Jul', read: false },
      { userId: user.id, type: 'goal', title: 'Goal progress', body: 'Goa Trip is 65% funded', read: true },
    ],
  })

  console.log('✓ Seed complete')
  console.log('  Email:    aarav@example.com')
  console.log('  Password: demo1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
