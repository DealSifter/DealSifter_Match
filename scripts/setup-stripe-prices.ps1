param(
  [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

$secretLine = Get-Content -LiteralPath $EnvFile |
  Where-Object { $_ -match '^STRIPE_SECRET_KEY=' } |
  Select-Object -First 1

$stripeKey = ($secretLine -replace '^STRIPE_SECRET_KEY=', '').Trim()
if ($stripeKey -notmatch '^sk_(test|live)_') {
  throw "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_."
}

$headers = @{ Authorization = "Bearer $stripeKey" }

function Get-OrCreatePrice {
  param(
    [string]$LookupKey,
    [string]$ProductName,
    [int]$UnitAmount,
    [bool]$Recurring
  )

  $encodedLookup = [uri]::EscapeDataString($LookupKey)
  $existing = Invoke-RestMethod `
    -Method Get `
    -Uri "https://api.stripe.com/v1/prices?lookup_keys[]=$encodedLookup&active=true&limit=1" `
    -Headers $headers

  if ($existing.data.Count -gt 0) {
    return $existing.data[0].id
  }

  $product = Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.stripe.com/v1/products" `
    -Headers $headers `
    -Body @{
      name = $ProductName
      "metadata[app]" = "dealsifter"
      "metadata[lookup_key]" = $LookupKey
    }

  $priceBody = @{
    product = $product.id
    currency = "usd"
    unit_amount = $UnitAmount
    lookup_key = $LookupKey
    "metadata[app]" = "dealsifter"
    "metadata[lookup_key]" = $LookupKey
  }

  if ($Recurring) {
    $priceBody["recurring[interval]"] = "month"
  }

  $price = Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.stripe.com/v1/prices" `
    -Headers $headers `
    -Body $priceBody

  return $price.id
}

$prices = [ordered]@{
  STRIPE_PRICE_P5 = Get-OrCreatePrice "dealsifter_nuggets_p5" "DealSifter Nuggets Pack - 5" 900 $false
  STRIPE_PRICE_P15 = Get-OrCreatePrice "dealsifter_nuggets_p15" "DealSifter Nuggets Pack - 15 + 2 bonus" 1900 $false
  STRIPE_PRICE_P40 = Get-OrCreatePrice "dealsifter_nuggets_p40" "DealSifter Nuggets Pack - 40 + 8 bonus" 3900 $false
  STRIPE_PRICE_P100 = Get-OrCreatePrice "dealsifter_nuggets_p100" "DealSifter Nuggets Pack - 100 + 25 bonus" 7900 $false
  STRIPE_PRICE_PLAN_PRO = Get-OrCreatePrice "dealsifter_plan_pro_monthly" "DealSifter Pro Monthly" 4900 $true
  STRIPE_PRICE_PLAN_ENTERPRISE = Get-OrCreatePrice "dealsifter_plan_enterprise_monthly" "DealSifter Enterprise Monthly" 12900 $true
}

$secretArgs = @()
foreach ($item in $prices.GetEnumerator()) {
  $secretArgs += "$($item.Key)=$($item.Value)"
}

supabase secrets set @secretArgs

Write-Host "Stripe prices are ready and Supabase Edge Function secrets were updated:"
foreach ($item in $prices.GetEnumerator()) {
  Write-Host "$($item.Key)=$($item.Value)"
}
