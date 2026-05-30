# Get admin session cookie and run live pricing tests
$base = "http://localhost:3001"

# Step 1: Get CSRF token from next-auth
try {
    $csrf = Invoke-WebRequest -Uri "$base/api/auth/csrf" -SessionVariable sess -TimeoutSec 10 -UseBasicParsing
    $csrfJson = $csrf.Content | ConvertFrom-Json
    $csrfToken = $csrfJson.csrfToken
    Write-Host "CSRF token: $csrfToken"
} catch {
    Write-Host "CSRF error: $($_.Exception.Message)"
    $csrfToken = ""
}

# Step 2: Sign in
try {
    $body = "csrfToken=$csrfToken&email=admin@secretza.com&password=admin123&callbackUrl=$base&json=true"
    $login = Invoke-WebRequest `
        -Uri "$base/api/auth/callback/credentials" `
        -Method POST `
        -Body $body `
        -ContentType "application/x-www-form-urlencoded" `
        -WebSession $sess `
        -TimeoutSec 10 `
        -UseBasicParsing
    Write-Host "Login status: $($login.StatusCode)"
} catch {
    Write-Host "Login error: $($_.Exception.Message)"
}

# Step 3: Check admin access
try {
    $check = Invoke-WebRequest -Uri "$base/api/admin/pricing-plans" -WebSession $sess -TimeoutSec 10 -UseBasicParsing
    Write-Host "Admin GET: $($check.StatusCode)"
    if ($check.StatusCode -eq 200) {
        # Collect all cookies
        $allCookies = $sess.Cookies.GetCookies($base)
        $cookieStr = ($allCookies | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; "
        Write-Host "COOKIE_STRING=$cookieStr"
        $cookieStr | Out-File -FilePath ".admin-cookie.txt" -Encoding utf8 -NoNewline
        Write-Host "Cookie saved to .admin-cookie.txt"
    }
} catch {
    Write-Host "Admin GET error: $($_.Exception.Message)"
}
