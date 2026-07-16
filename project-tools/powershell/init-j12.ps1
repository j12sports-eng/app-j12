$folders = @(

"tools",

"tools\\powershell",

"tools\\templates",

"tools\\templates\\markdown",

"tools\\templates\\json",

"tools\\templates\\yaml",

"tools\\templates\\typescript",

"tools\\templates\\react",

"tools\\templates\\express",

"tools\\templates\\sql"

)

foreach($folder in $folders){

    New-Item -ItemType Directory -Force -Path $folder | Out-Null

}

Write-Host ""
Write-Host "Toolkit inicializado." -ForegroundColor Green