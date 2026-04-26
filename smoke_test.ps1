$email = "test@example.com"
function Invoke-Api {
    param($url, $method, $body, $token)
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers.Add("Authorization", "Bearer $token") }
    $bodyJson = if ($body) { $body | ConvertTo-Json } else { $null }
    return Invoke-WebRequest -Uri $url -Method $method -Body $bodyJson -Headers $headers -ErrorAction Stop -UseBasicParsing
}
try {
    $login = Invoke-Api "http://localhost:3001/api/auth/login" "POST" @{ email=$email; password="password123" }
    $loginData = $login.Content | ConvertFrom-Json
    $token = $loginData.accessToken
    $chat = Invoke-Api "http://localhost:3001/api/chat" "POST" @{ message="top 5 latest movie releases" } $token
    $chatData = $chat.Content | ConvertFrom-Json
    Write-Host "RESULT_START"
    Write-Host "STATUS: $($chat.StatusCode)"
    Write-Host "REPLY: $($chatData.response)"
    Write-Host "RESULT_END"
} catch {
    Write-Host "API_FAILED: $($_.Exception.Message)"
}
