$cases = @(
  @{ label='keyword only';             q='keyword=escort&limit=5' },
  @{ label='category only';            q='category=escorts&limit=5' },
  @{ label='keyword + category';       q='keyword=escort&category=escorts&limit=5' },
  @{ label='keyword+category+city';    q='keyword=escort&category=escorts&city=mumbai&limit=5' },
  @{ label='page=9999 (empty)';        q='limit=3&page=9999' },
  @{ label='page=1 (total check)';     q='limit=3&page=1' },
  @{ label='sortBy=ranking';           q='sortBy=ranking&limit=3' },
  @{ label='sortBy=relevance';         q='sortBy=relevance&limit=3' },
  @{ label='sortBy=newest';            q='sortBy=newest&limit=3' },
  @{ label='sortBy=featured';          q='sortBy=featured&limit=3' },
  @{ label='sortBy=price_low';         q='sortBy=price_low&limit=3' },
  @{ label='sortBy=price_high';        q='sortBy=price_high&limit=3' }
)

$results = @()

foreach ($c in $cases) {
  try {
    $r = Invoke-WebRequest -Uri ("http://localhost:3001/api/listings?" + $c.q) -TimeoutSec 20 -UseBasicParsing
    $d = $r.Content | ConvertFrom-Json
    $row = [PSCustomObject]@{
      label       = $c.label
      status      = $r.StatusCode
      total       = $d.total
      count       = $d.listings.Count
      totalPages  = $d.totalPages
      error       = ""
    }
    Write-Host ("[OK ] " + $c.label.PadRight(30) + " status=" + $r.StatusCode + " total=" + $d.total + " count=" + $d.listings.Count)
  } catch {
    $row = [PSCustomObject]@{
      label       = $c.label
      status      = 0
      total       = -1
      count       = -1
      totalPages  = -1
      error       = $_.Exception.Message
    }
    Write-Host ("[ERR] " + $c.label.PadRight(30) + " " + $_.Exception.Message)
  }
  $results += $row
}

$results | ConvertTo-Json | Out-File -FilePath "artifacts\search-filters-verification\live-results.json" -Encoding utf8
Write-Host "`nResults saved to artifacts\search-filters-verification\live-results.json"
