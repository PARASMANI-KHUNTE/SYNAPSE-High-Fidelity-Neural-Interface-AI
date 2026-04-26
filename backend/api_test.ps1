try {
    $loginBody = @{ email="smoke_test@example.com"; password="password123" } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.accessToken
    
    $chatBody = @{ message="top 5 things happening in the world right now" } | ConvertTo-Json
    $chatResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/chat" -Method Post -Headers @{ Authorization = "Bearer $token" } -Body $chatBody -ContentType "application/json"
    
    # Check both 'reply' and 'response' as field names
    $reply = $chatResponse.reply
    if ($null -eq $reply) { $reply = $chatResponse.response }
    
    Write-Output "---RAW_START---"
    $chatResponse | ConvertTo-Json
    Write-Output "---RAW_END---"
    
    $substring = if ($null -ne $reply -and $reply.Length -gt 1200) { $reply.Substring(0, 1200) } else { $reply }
    Write-Output "---SUBSTRING_START---"
    Write-Output $substring
    Write-Output "---SUBSTRING_END---"
    
    $containsMsg = $reply -like "*I don't have real-time access*"
    Write-Output "REALTIME_MSG_BOOL: $containsMsg"
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
