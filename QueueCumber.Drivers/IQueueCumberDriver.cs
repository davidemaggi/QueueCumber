using QueueCumber.Models;
using QueueCumber.Models.Entities;
using QueueCumber.Models.Queues;

namespace QueueCumber.Drivers
{
    public interface IQueueCumberDriver
    {

        public Enums.Drivers getDriver();
        public bool hasQueues();
        public bool hasStreams();
        public bool isConnected();
        public Guid getSessionId();
        public void Disconnect();


        public static abstract IQueueCumberDriver Connect(QueueCumberConnection connection);

        //Queues


        public void createQueue(string name, bool durable = false, bool exclusive = false, bool autoDelete = false, IDictionary<string, Object> arguments = null)
        {

            if (!hasQueues()) throw new Exception("Queues are not supported");

        }

        public async Task<ICollection<QueueCumberQueue>> getAllQueues()
        {

            if (!hasQueues()) throw new Exception("Queues are not supported");
            return new List<QueueCumberQueue>();
        }

    }
}
