"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts"
import { TrendingUp, Zap, Target, Activity, BarChart3 } from 'lucide-react'

const initialChartData = [
  { time: "00:21:54", value: 2.1 },
  { time: "00:22:22", value: 2.2 },
  { time: "00:22:52", value: 2.35 },
  { time: "00:23:22", value: 2.36 },
  { time: "00:23:52", value: 2.37 },
  { time: "00:24:22", value: 2.4 },
]

export default function PredictionMarkets() {
  const [threshold, setThreshold] = useState("250000")
  const [duration, setDuration] = useState("12h")
  const [betAmount, setBetAmount] = useState("0.1")
  const [prediction, setPrediction] = useState<"ABOVE" | "BELOW">("ABOVE")

  const [chartData, setChartData] = useState(initialChartData)
  const [currentTransactions, setCurrentTransactions] = useState(2365201)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const timeString = now.toTimeString().slice(0, 8)

      // Generate realistic transaction growth (small random variations)
      const lastValue = chartData[chartData.length - 1]?.value || 2.4
      const variation = (Math.random() - 0.5) * 0.1 // ±0.05M variation
      const newValue = Math.max(0, lastValue + variation + 0.01) // Slight upward trend

      // Update chart data (keep last 10 points for smooth animation)
      setChartData((prev) => {
        const newData = [...prev, { time: timeString, value: Number.parseFloat(newValue.toFixed(2)) }]
        return newData.slice(-10) // Keep only last 10 points
      })

      // Update current transactions count
      setCurrentTransactions((prev) => {
        const change = Math.floor((Math.random() - 0.4) * 1000) // Mostly positive growth
        return Math.max(0, prev + change)
      })
    }, 2000) // Update every 2 seconds

    return () => clearInterval(interval)
  }, [chartData])

  return (
    <div className="min-h-screen gradient-bg p-6 space-y-8">
      {/*  Updated header with Cryps-inspired styling */}
      <div className="text-center space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary cryps-glow float-animation flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-black font-serif text-gradient">
            Prediction Markets
          </h1>
        </div>
        <p className="text-lg text-muted-foreground font-medium">
          Bet on Intuition Blockchain transaction volumes with real-time data
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/*  Enhanced Create New Market card with Cryps styling */}
        <Card className="cryps-card float-animation">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 font-serif font-bold text-xl text-foreground">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              Create New Market
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Transaction Threshold</label>
              <Input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="h-12 bg-input border-2 border-border text-foreground text-lg font-medium focus:border-primary focus:ring-ring transition-all duration-300"
                placeholder="250000"
              />
              <p className="text-sm text-muted-foreground">
                Users will bet if transactions will be <span className="text-primary font-semibold">ABOVE</span> or <span className="text-destructive font-semibold">BELOW</span> this number
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Market Duration</label>
              <div className="grid grid-cols-4 gap-3">
                {["1h", "2h", "5h", "12h"].map((time) => (
                  <Button
                    key={time}
                    variant={duration === time ? "default" : "secondary"}
                    size="lg"
                    onClick={() => setDuration(time)}
                    className={
                      duration === time
                        ? "bg-primary text-primary-foreground cryps-button-glow font-semibold"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 transition-all duration-300"
                    }
                  >
                    +{time}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Market will end in <span className="text-primary font-semibold">{duration}</span> from creation</p>
            </div>

            <Button className="w-full h-14 bg-primary text-primary-foreground cryps-button-glow font-bold text-lg hover:bg-primary/90 transition-all duration-300">
              <Zap className="w-5 h-5 mr-2" />
              Create Market
            </Button>
          </CardContent>
        </Card>

        {/*  Enhanced Live Transaction Data card */}
        <Card className="cryps-card float-animation" style={{ animationDelay: "0.3s" }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 font-serif font-bold text-xl text-foreground">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-secondary" />
              </div>
              Live Transaction Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">Current Transactions</label>
                <Badge className="bg-secondary/10 text-secondary border-secondary/20 pulse-soft">
                  <div className="w-2 h-2 bg-secondary rounded-full mr-2"></div>
                  LIVE
                </Badge>
              </div>
              <div className="text-5xl font-black font-serif text-gradient transition-all duration-500">
                {currentTransactions.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                Real-time data from Intuition API
              </p>
            </div>

            {/*  Enhanced chart with better Cryps styling */}
            <div className="h-56 w-full relative rounded-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-secondary/5"></div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="transactionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="var(--color-secondary)" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" opacity={0.4} />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "var(--color-muted-foreground)",
                      fontSize: 12,
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "var(--color-muted-foreground)",
                      fontSize: 12,
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                    }}
                    domain={["dataMin - 0.1", "dataMax + 0.1"]}
                    tickFormatter={(value) => `${value}M`}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={3}
                    fill="url(#transactionGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={3}
                    dot={{
                      fill: "var(--color-primary)",
                      strokeWidth: 3,
                      stroke: "var(--color-background)",
                      r: 4,
                    }}
                    activeDot={{
                      r: 6,
                      fill: "var(--color-primary)",
                      stroke: "var(--color-background)",
                      strokeWidth: 3,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/*  Enhanced Place Your Bet section */}
      <Card className="cryps-card max-w-6xl mx-auto float-animation" style={{ animationDelay: "0.6s" }}>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 font-serif font-bold text-2xl text-foreground">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            Place Your Bet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Select Market</label>
              <select className="w-full h-12 p-3 bg-input border-2 border-border rounded-lg text-foreground font-medium focus:border-primary focus:ring-ring transition-all duration-300">
                <option>Choose a market...</option>
                <option>Transactions &gt; 250,000 (12h)</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Your Prediction</label>
              <div className="flex gap-3">
                <Button
                  variant={prediction === "ABOVE" ? "default" : "secondary"}
                  onClick={() => setPrediction("ABOVE")}
                  className={
