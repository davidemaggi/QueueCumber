using EasyNetQ.Management.Client;
using QueueCumber.Models.Queues;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace QueueCumber.Drivers.RabbitMQ
{
    public partial class QueueCumberDriverRabbitMQ : IQueueCumberDriver
    {

        public async Task<ICollection<QueueCumberQueue>> getAllQueues() { 
        var ret=new List<QueueCumberQueue>();

            var tmp = await _managementApi.GetQueuesAsync();

            foreach (var queue in tmp) {

                ret.Add(new QueueCumberQueue { Name= queue.Name});
            
            }

            return ret;
        
        }


        public void createQueue(string name, bool durable=false, bool exclusive = false, bool autoDelete = false, IDictionary<string,Object> arguments = null)
        {

            _channel.QueueDeclare(queue: name,
                     durable: durable,
                     exclusive: exclusive,
                     autoDelete: autoDelete,
                     arguments: arguments);

        }


    }
}
