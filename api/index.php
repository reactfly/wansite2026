<?php

declare(strict_types=1);

/**
 * Reads a simple KEY=VALUE .env file.
 * Existing system environment variables still take precedence.
 */
function readEnvFile(string $path): array
{
    if (!is_file($path) || !is_readable($path)) {
        return [];
    }

    $data = [];
    $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return [];
    }

    foreach ($lines as $rawLine) {
        $line = trim((string) $rawLine);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $eqPos = strpos($line, '=');
        if ($eqPos === false) {
            continue;
        }

        $key = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));
        if ($key === '') {
            continue;
        }

        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        $data[$key] = $value;
    }

    return $data;
}

$projectEnv = readEnvFile(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

$configuredTarget = getenv('API_PROXY_TARGET');
if (!is_string($configuredTarget) || trim($configuredTarget) === '') {
    $configuredTarget = (string) ($projectEnv['API_PROXY_TARGET'] ?? '');
}

if (trim($configuredTarget) !== '') {
    $targetBase = rtrim($configuredTarget, '/');
} else {
    $configuredPort = getenv('API_PROXY_PORT');
    if (!is_string($configuredPort) || trim($configuredPort) === '') {
        $configuredPort = (string) ($projectEnv['API_PROXY_PORT'] ?? '');
    }
    if (trim($configuredPort) === '') {
        $configuredPort = (string) ($projectEnv['PORT'] ?? '3000');
    }

    $portDigits = preg_replace('/[^0-9]/', '', $configuredPort);
    if (!is_string($portDigits) || $portDigits === '') {
        $portDigits = '3000';
    }

    $targetBase = 'http://127.0.0.1:' . $portDigits;
}

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/api', PHP_URL_PATH) ?: '/api';
$queryString = $_SERVER['QUERY_STRING'] ?? '';

if (!str_starts_with($requestPath, '/api')) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Invalid API path']);
    exit;
}

$forwardPath = $requestPath;
$targetUrl = $targetBase . $forwardPath . ($queryString !== '' ? ('?' . $queryString) : '');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = file_get_contents('php://input');
$hasUploadedFiles = !empty($_FILES);

$incomingHeaders = function_exists('getallheaders') ? getallheaders() : [];
$forwardHeaders = [];

foreach ($incomingHeaders as $name => $value) {
    $lower = strtolower($name);

    if (in_array($lower, ['host', 'connection', 'content-length', 'accept-encoding'], true)) {
        continue;
    }

    // cURL will rebuild proper multipart headers/boundaries
    if ($hasUploadedFiles && in_array($lower, ['content-type'], true)) {
        continue;
    }

    $forwardHeaders[] = $name . ': ' . $value;
}

if (!array_key_exists('X-Forwarded-For', $incomingHeaders)) {
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($clientIp !== '') {
        $forwardHeaders[] = 'X-Forwarded-For: ' . $clientIp;
    }
}

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);

if (!in_array($method, ['GET', 'HEAD'], true)) {
    if ($hasUploadedFiles) {
        $postFields = $_POST;
        foreach ($_FILES as $fieldName => $fileInfo) {
            if (!is_array($fileInfo) || empty($fileInfo['tmp_name'])) {
                continue;
            }

            if (!is_uploaded_file($fileInfo['tmp_name'])) {
                continue;
            }

            $mime = $fileInfo['type'] ?? 'application/octet-stream';
            $name = $fileInfo['name'] ?? 'upload.bin';
            $postFields[$fieldName] = new CURLFile($fileInfo['tmp_name'], $mime, $name);
        }

        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    } elseif ($body !== false && $body !== '') {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
}

$rawResponse = curl_exec($ch);

if ($rawResponse === false) {
    $errorMessage = curl_error($ch);
    curl_close($ch);

    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'Proxy failure',
        'target' => $targetUrl,
        'details' => $errorMessage,
    ]);
    exit;
}

$statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawHeaderBlock = substr($rawResponse, 0, $headerSize);
$responseBody = substr($rawResponse, $headerSize);

$headerBlocks = preg_split("/(\r\n){2,}/", trim($rawHeaderBlock));
$headerLines = [];
if (is_array($headerBlocks) && count($headerBlocks) > 0) {
    $headerLines = preg_split("/\r\n/", (string) end($headerBlocks));
}

$passthrough = ['content-type', 'set-cookie', 'cache-control', 'pragma', 'expires'];

if (is_array($headerLines)) {
    foreach ($headerLines as $line) {
        if ($line === '' || stripos($line, 'HTTP/') === 0 || strpos($line, ':') === false) {
            continue;
        }

        [$name, $value] = array_map('trim', explode(':', $line, 2));
        $nameLower = strtolower($name);

        if (in_array($nameLower, $passthrough, true)) {
            header($name . ': ' . $value, false);
        }
    }
}

http_response_code($statusCode > 0 ? $statusCode : 200);
echo $responseBody;
