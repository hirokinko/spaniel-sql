-- @spaniel param amount type=Big
-- @spaniel result Amount type=Big
SELECT
  CAST(@id AS INT64) AS Id,
  CAST(@amount AS NUMERIC) AS Amount,
  CAST(@rate AS NUMERIC) AS Rate,
  CAST(@day AS DATE) AS Day,
  CAST(@instant AS TIMESTAMP) AS Instant,
  CAST(@payload AS JSON) AS Payload,
  CAST(@ids AS ARRAY<INT64>) AS Ids,
  CAST(@label AS STRING) AS Label,
  CAST(@enabled AS BOOL) AS Enabled,
  CAST(@data AS BYTES) AS Data,
  CAST(@score AS FLOAT64) AS Score
