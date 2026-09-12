-- Ушарал маленький, каждого водителя знают в лицо: держать заявки в PENDING
-- незачем, а одобрять их было некому — админа в проде не было вовсе.
UPDATE "DriverProfile" SET status = 'APPROVED' WHERE status = 'PENDING';
